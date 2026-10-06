<?php

namespace App\Http\Controllers;

use App\Concerns\ClampsRequestedMonth;
use App\Enums\EquipmentDivision;
use App\Enums\EquipmentServiceType;
use App\Enums\ScheduledCheckStatus;
use App\Enums\ServiceStatus;
use App\Models\ClosedDay;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentServiceRecord;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentScheduleController extends Controller
{
    use ClampsRequestedMonth;

    /**
     * Display a month of the division's equipment maintenance calendar: the
     * maintenance planned in or done, and the checklists run, kept apart from
     * the mechanics' vehicle schedule and the other division's.
     * Maintenance over several days goes on the calendar once for each of
     * its days in the month, but only counts once in the month's stats.
     */
    public function index(Request $request, EquipmentDivision $division): Response
    {
        $today = today();
        $month = $this->requestedMonth($request, $today);
        $startOfMonth = $month->startOfMonth();
        $endOfMonth = $month->endOfMonth();
        $between = [$startOfMonth->toDateString(), $endOfMonth->toDateString()];

        $jobs = EquipmentServiceRecord::query()
            ->inDivision($division)
            ->with('equipment')
            ->bookedBetween(...$between)
            ->get()
            ->map(fn (EquipmentServiceRecord $job): array => [
                ...$this->jobEntry($job, $today),
                'days_this_month' => array_values(array_filter(
                    $job->days(),
                    fn (string $day): bool => str_starts_with($day, $startOfMonth->format('Y-m')),
                )),
            ])
            ->filter(fn (array $job): bool => $job['days_this_month'] !== []);

        $jobDays = $jobs->flatMap(fn (array $job): array => array_map(
            fn (string $day): array => [...Arr::except($job, 'days_this_month'), 'date' => $day],
            $job['days_this_month'],
        ));

        $checklists = EquipmentChecklist::query()
            ->inDivision($division)
            ->with('equipment')
            ->whereBetween('performed_on', $between)
            ->get()
            ->map(fn (EquipmentChecklist $checklist): array => $this->checklistEntry($checklist));

        $entries = $jobDays->concat($checklists)
            ->sortBy(fn (array $entry): array => [$entry['date'], $entry['kind'] === 'job' ? 1 : 0, $entry['equipment']['name'] ?? ''])
            ->values();

        return Inertia::render('equipment-schedule/index', [
            'division' => $division->value,
            'month' => $startOfMonth->format('Y-m'),
            'today' => $today->toDateString(),
            'entries' => $entries->all(),
            'stats' => [
                'jobs' => $jobs->count(),
                'jobs_done' => $jobs->where('status', ScheduledCheckStatus::Done->value)->count(),
                'behind' => $jobs->where('status', ScheduledCheckStatus::Overdue->value)->count(),
                'checklists' => $checklists->count(),
            ],
            'equipment' => Equipment::options($division),
            'types' => EquipmentServiceType::options(),
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
     * Describe maintenance planned in, or done, on a day of the month. Any
     * not yet started is due on each day it is booked on, and overdue on
     * any other day once its first day has gone by.
     *
     * @return array<string, mixed>
     */
    private function jobEntry(EquipmentServiceRecord $job, CarbonImmutable $today): array
    {
        $days = $job->days();

        $status = match (true) {
            $job->status === ServiceStatus::Completed => ScheduledCheckStatus::Done,
            $job->status === ServiceStatus::InProgress => ScheduledCheckStatus::InProgress,
            in_array($today->toDateString(), $days, true) => ScheduledCheckStatus::Due,
            $days[0] < $today->toDateString() => ScheduledCheckStatus::Overdue,
            default => ScheduledCheckStatus::Upcoming,
        };

        return [
            'id' => $job->id,
            'kind' => 'job',
            'title' => $job->title,
            'type_label' => $job->type->label(),
            'date' => $days[0],
            'days' => $days,
            'status' => $status->value,
            'equipment' => $this->equipment($job->equipment),
            'checklist_id' => null,
            'can_move' => $job->status !== ServiceStatus::Completed,
            'can_remove' => $job->status === ServiceStatus::Planned,
            'window' => null,
        ];
    }

    /**
     * Describe a checklist run against a piece of equipment on a day.
     *
     * @return array<string, mixed>
     */
    private function checklistEntry(EquipmentChecklist $checklist): array
    {
        return [
            'id' => $checklist->id,
            'kind' => 'checklist',
            'title' => $checklist->title,
            'type_label' => null,
            'date' => $checklist->performed_on->toDateString(),
            'status' => ($checklist->is_complete ? ScheduledCheckStatus::Done : ScheduledCheckStatus::InProgress)->value,
            'equipment' => $this->equipment($checklist->equipment),
            'checklist_id' => $checklist->id,
            'can_move' => false,
            'can_remove' => false,
            'window' => null,
        ];
    }

    /**
     * @return array{id: string, name: string, location: string|null}|null
     */
    private function equipment(?Equipment $equipment): ?array
    {
        return $equipment === null ? null : [
            'id' => $equipment->id,
            'name' => $equipment->name,
            'location' => $equipment->location,
        ];
    }
}
