<?php

namespace App\Http\Controllers;

use App\Actions\PlanInspectionSchedule;
use App\Concerns\ClampsRequestedMonth;
use App\Concerns\PutsJobsOnCalendar;
use App\Enums\ChecklistTemplate;
use App\Enums\ScheduledCheckStatus;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Models\ClosedDay;
use App\Models\Inspection;
use App\Models\PlannedInspection;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ScheduleController extends Controller
{
    use ClampsRequestedMonth, PutsJobsOnCalendar;

    /**
     * How many months past the one on screen get booked in as well.
     */
    private const MONTHS_AHEAD = 2;

    /**
     * Display a month of the calendar: every vehicle's monthly check and
     * annual inspection, booked in automatically, and the jobs planned in.
     * A job over several days goes on the calendar once for each of its
     * days in the month, but only counts once in the month's stats.
     */
    public function index(Request $request, PlanInspectionSchedule $planSchedule): Response
    {
        $today = today();
        $month = $this->requestedMonth($request, $today);
        $startOfMonth = $month->startOfMonth();
        $endOfMonth = $month->endOfMonth();

        // Keep the next couple of months booked in ahead as well, so what is
        // coming up is already on the calendar.
        foreach (range(0, self::MONTHS_AHEAD) as $offset) {
            $planSchedule->handle($month->addMonthsNoOverflow($offset));
        }

        $inspections = Inspection::query()
            ->whereIn('template', [ChecklistTemplate::MonthlyCheck, ChecklistTemplate::AnnualInspection])
            ->whereBetween('performed_on', [$startOfMonth->startOfYear()->toDateString(), $endOfMonth->endOfYear()->toDateString()])
            ->latest('performed_on')
            ->get()
            ->groupBy('vehicle_id');

        $checks = PlannedInspection::query()
            ->with('vehicle')
            ->where(fn ($query) => $query
                ->where(fn ($monthly) => $monthly
                    ->where('template', ChecklistTemplate::MonthlyCheck)
                    ->where('period', PlannedInspection::periodFor(ChecklistTemplate::MonthlyCheck, $month)))
                ->orWhere(fn ($annual) => $annual
                    ->where('template', ChecklistTemplate::AnnualInspection)
                    ->where('period', PlannedInspection::periodFor(ChecklistTemplate::AnnualInspection, $month))))
            ->get()
            ->map(fn (PlannedInspection $planned): ?array => $this->checkEntry(
                $planned,
                $inspections->get($planned->vehicle_id, collect()),
                $today,
            ))
            ->filter();

        $annualChecks = $checks->where('kind', ChecklistTemplate::AnnualInspection->value);
        $checks = $checks->filter(fn (array $entry): bool => str_starts_with($entry['date'], $startOfMonth->format('Y-m')));

        $jobs = ServiceRecord::query()
            ->with('vehicle')
            ->bookedBetween($startOfMonth->toDateString(), $endOfMonth->toDateString())
            ->get()
            ->map(fn (ServiceRecord $job): array => $this->jobEntry($job, $today));

        [$jobs, $jobDays] = $this->jobsInMonth($jobs, $startOfMonth);

        $behind = [ScheduledCheckStatus::Overdue->value, ScheduledCheckStatus::Missed->value];

        $entries = $checks->concat($jobDays)
            ->sortBy(fn (array $entry): array => [$entry['date'], $entry['kind'] === 'job' ? 1 : 0, $entry['vehicle']['display_name'] ?? ''])
            ->values();

        return Inertia::render('schedule/index', [
            'month' => $startOfMonth->format('Y-m'),
            'today' => $today->toDateString(),
            'entries' => $entries->all(),
            'stats' => [
                'checks' => $checks->count(),
                'checks_done' => $checks->where('status', ScheduledCheckStatus::Done->value)->count(),
                'annual' => $annualChecks->count(),
                'annual_done' => $annualChecks->where('status', ScheduledCheckStatus::Done->value)->count(),
                'behind' => $checks->whereIn('status', $behind)->count() + $jobs->whereIn('status', $behind)->count(),
                'jobs' => $jobs->count(),
            ],
            'vehicles' => Vehicle::query()
                ->alphabetical()
                ->get()
                ->map(fn (Vehicle $vehicle): array => ['value' => $vehicle->id, 'label' => $vehicle->display_name])
                ->all(),
            'types' => ServiceType::options(),
            'closedDays' => collect(ClosedDay::between($startOfMonth, $endOfMonth))
                ->map(fn (array $closed, string $date): array => [
                    'date' => $date,
                    'reason' => $closed['reason'],
                    'id' => $closed['id'],
                ])
                ->values()
                ->all(),
        ]);
    }

    /**
     * Describe a booked check, shown on the day it was done if it has been
     * and on the day it is booked for if not.
     *
     * @param  Collection<int, Inspection>  $inspections  the vehicle's checks this year
     * @return array<string, mixed>|null null for a check taken off the schedule
     */
    private function checkEntry(PlannedInspection $planned, Collection $inspections, CarbonImmutable $today): ?array
    {
        $windowStart = $planned->windowStart();
        $windowEnd = $planned->windowEnd();

        $candidates = $inspections->filter(fn (Inspection $inspection): bool => $planned->isCoveredBy($inspection));

        $inspection = $candidates->first(fn (Inspection $inspection): bool => $inspection->is_complete)
            ?? $candidates->first();

        // Taken off the schedule, unless someone went and did it anyway.
        if ($planned->skipped && $inspection === null) {
            return null;
        }

        $status = match (true) {
            $inspection?->is_complete === true => ScheduledCheckStatus::Done,
            $inspection !== null => ScheduledCheckStatus::InProgress,
            $windowEnd->lessThan($today) => ScheduledCheckStatus::Missed,
            $planned->due_on->lessThan($today) => ScheduledCheckStatus::Overdue,
            $planned->due_on->isSameDay($today) => ScheduledCheckStatus::Due,
            default => ScheduledCheckStatus::Upcoming,
        };

        return [
            'id' => $planned->id,
            'kind' => $planned->template->value,
            'title' => $planned->template->label(),
            'date' => ($inspection?->performed_on ?? $planned->due_on)->toDateString(),
            'due_on' => $planned->due_on->toDateString(),
            'status' => $status->value,
            'vehicle' => $this->vehicle($planned->vehicle),
            'inspection_id' => $inspection?->id,
            'service_record_id' => null,
            'can_move' => $inspection === null && $windowEnd->greaterThanOrEqualTo($today),
            'can_remove' => $inspection === null,
            'window' => [
                'from' => $windowStart->max($today)->toDateString(),
                'to' => $windowEnd->toDateString(),
            ],
        ];
    }

    /**
     * Describe a job planned in, or done, on a day of the month.
     *
     * @return array<string, mixed>
     */
    private function jobEntry(ServiceRecord $job, CarbonImmutable $today): array
    {
        $days = $job->days();

        return [
            'id' => $job->id,
            'kind' => 'job',
            'title' => $job->title,
            'date' => $days[0],
            'due_on' => $days[0],
            'days' => $days,
            'status' => $this->jobStatus($job, $today)->value,
            'vehicle' => $this->vehicle($job->vehicle),
            'inspection_id' => null,
            'service_record_id' => $job->id,
            'can_move' => $job->status !== ServiceStatus::Completed,
            'can_remove' => $job->status === ServiceStatus::Planned,
            'window' => null,
        ];
    }

    /**
     * @return array{id: string, display_name: string, registration: string|null}|null
     */
    private function vehicle(?Vehicle $vehicle): ?array
    {
        return $vehicle === null ? null : [
            'id' => $vehicle->id,
            'display_name' => $vehicle->display_name,
            'registration' => $vehicle->registration,
        ];
    }
}
