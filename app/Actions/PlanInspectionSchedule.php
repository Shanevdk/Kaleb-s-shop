<?php

namespace App\Actions;

use App\Enums\ChecklistTemplate;
use App\Enums\ServiceStatus;
use App\Models\ClosedDay;
use App\Models\PlannedInspection;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Books every Norwich vehicle in for its monthly check and annual inspection,
 * spreading the work over the days the shop is open so no one day gets
 * swamped. Nothing is ever booked onto a Sunday, an Ontario statutory
 * holiday or a day marked closed; weekdays are filled before Saturdays.
 *
 * Running it again only fills gaps, and moves the checks it booked itself off
 * any day that has since been marked closed. A check someone moved by hand
 * stays where they put it, and one taken off the schedule is not booked back.
 */
class PlanInspectionSchedule
{
    /**
     * How much of a day each kind of work takes up.
     */
    private const WEIGHT_MONTHLY_CHECK = 1;

    private const WEIGHT_ANNUAL_INSPECTION = 3;

    private const WEIGHT_JOB = 2;

    /**
     * The work already booked on each day, keyed by date.
     *
     * @var array<string, int>
     */
    private array $load = [];

    /**
     * The months whose days have been added to the load.
     *
     * @var array<string, true>
     */
    private array $countedMonths = [];

    /**
     * The days of the year the shop is shut, keyed by date.
     *
     * @var array<string, array{reason: string, id: string|null}>
     */
    private array $closed = [];

    /**
     * How many annual inspections are booked into each month of the year.
     *
     * @var array<int, int>
     */
    private array $annualsPerMonth = [];

    /**
     * Book in everything the given month needs. Months already over are left
     * alone; there is no booking anyone into the past.
     */
    public function handle(CarbonImmutable $month): void
    {
        $startOfMonth = $month->startOfMonth();
        $today = today();

        if ($startOfMonth->endOfMonth()->lessThan($today)) {
            return;
        }

        Cache::lock('plan-inspection-schedule', 30)->block(10, function () use ($startOfMonth, $today): void {
            $this->load = [];
            $this->countedMonths = [];
            $this->closed = ClosedDay::between($startOfMonth->startOfYear(), $startOfMonth->endOfYear());

            DB::transaction(fn () => $this->plan($startOfMonth, $today));
        });
    }

    /**
     * Fill in the month's gaps, vehicle by vehicle.
     */
    private function plan(CarbonImmutable $startOfMonth, CarbonImmutable $today): void
    {
        $this->moveOffClosedDays($startOfMonth, $today);

        $monthPeriod = PlannedInspection::periodFor(ChecklistTemplate::MonthlyCheck, $startOfMonth);
        $yearPeriod = PlannedInspection::periodFor(ChecklistTemplate::AnnualInspection, $startOfMonth);

        $vehicles = Vehicle::query()
            ->where(fn ($query) => $query
                ->whereNull('created_at')
                ->orWhere('created_at', '<=', $startOfMonth->endOfMonth()))
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $booked = PlannedInspection::query()
            ->where(fn ($query) => $query
                ->where(fn ($monthly) => $monthly->where('template', ChecklistTemplate::MonthlyCheck)->where('period', $monthPeriod))
                ->orWhere(fn ($annual) => $annual->where('template', ChecklistTemplate::AnnualInspection)->where('period', $yearPeriod)))
            ->get()
            ->keyBy(fn (PlannedInspection $planned): string => "{$planned->vehicle_id}|{$planned->template->value}");

        $this->annualsPerMonth = PlannedInspection::query()
            ->where('template', ChecklistTemplate::AnnualInspection)
            ->where('period', $yearPeriod)
            ->pluck('due_on')
            ->countBy(fn (CarbonInterface $dueOn): int => $dueOn->month)
            ->all();

        foreach ($vehicles as $vehicle) {
            $bookedAnnual = $booked->get("{$vehicle->id}|".ChecklistTemplate::AnnualInspection->value);
            $bookedMonthly = $booked->get("{$vehicle->id}|".ChecklistTemplate::MonthlyCheck->value);

            // Vehicles kept at Kentwood are looked after off the schedule.
            // Take off the checks booked before it moved there, unless
            // someone has already started them.
            if (! $vehicle->location->isBookedAutomatically()) {
                collect([$bookedAnnual, $bookedMonthly])
                    ->filter()
                    ->reject(fn (PlannedInspection $planned): bool => $planned->hasBeenStarted())
                    ->each(fn (PlannedInspection $planned) => $this->retract($planned));

                continue;
            }

            // Non-highway vehicles never see a public road, so they are
            // exempt from the roadworthy-style annual inspection. Retract
            // one booked before the vehicle became exempt.
            if ($vehicle->category->isExemptFromAnnualInspection()) {
                if ($bookedAnnual !== null) {
                    $this->retract($bookedAnnual);
                }

                $annual = null;
            } else {
                $annual = $bookedAnnual ?? $this->bookAnnual($vehicle, $startOfMonth, $today);
            }

            $monthly = $bookedMonthly;

            // The annual inspection covers the monthly check for its month,
            // unless it has been taken off the schedule.
            if ($annual !== null && ! $annual->skipped && $annual->due_on->isSameMonth($startOfMonth)) {
                $monthly?->delete();

                continue;
            }

            if ($monthly === null) {
                $this->book($vehicle, ChecklistTemplate::MonthlyCheck, $startOfMonth, $today);
            }
        }
    }

    /**
     * Move the checks the planner put on a day the shop turned out to be shut
     * to the quietest open day left in the same month.
     */
    private function moveOffClosedDays(CarbonImmutable $startOfMonth, CarbonImmutable $today): void
    {
        $from = $startOfMonth->max($today);
        $until = $startOfMonth->endOfMonth();

        PlannedInspection::query()
            ->where('pinned', false)
            ->where('skipped', false)
            ->whereBetween('due_on', [$from->toDateString(), $until->toDateString()])
            ->get()
            ->reject(fn (PlannedInspection $planned): bool => ClosedDay::isOpenOn($planned->due_on, $this->closed))
            ->each(function (PlannedInspection $planned) use ($from, $until): void {
                $day = $this->quietestDay($from, $until);

                if ($day === null) {
                    return;
                }

                $weight = $this->weightOf($planned->template);
                $this->load[$planned->due_on->toDateString()] -= $weight;
                $this->load[$day->toDateString()] += $weight;

                $planned->update(['due_on' => $day->toDateString()]);
            });
    }

    /**
     * Delete a booked check that is no longer needed, freeing up the load
     * it took up, and an annual inspection's place in its month's tally.
     */
    private function retract(PlannedInspection $planned): void
    {
        $dueOn = $planned->due_on->toDateString();

        if (isset($this->load[$dueOn]) && ! $planned->skipped) {
            $this->load[$dueOn] -= $this->weightOf($planned->template);
        }

        $month = $planned->due_on->month;

        if ($planned->template === ChecklistTemplate::AnnualInspection && isset($this->annualsPerMonth[$month])) {
            $this->annualsPerMonth[$month]--;
        }

        $planned->delete();
    }

    /**
     * Book the vehicle's annual inspection into the month still to come this
     * year with the fewest in it, so they spread across the year.
     */
    private function bookAnnual(Vehicle $vehicle, CarbonImmutable $month, CarbonImmutable $today): ?PlannedInspection
    {
        $firstMonth = $month->year === $today->year ? $today->month : 1;

        $candidates = collect(range($firstMonth, 12))
            ->sortBy(fn (int $candidate): array => [$this->annualsPerMonth[$candidate] ?? 0, $candidate]);

        foreach ($candidates as $candidate) {
            $booked = $this->book($vehicle, ChecklistTemplate::AnnualInspection, $month->setDate($month->year, $candidate, 1), $today);

            if ($booked !== null) {
                $this->annualsPerMonth[$candidate] = ($this->annualsPerMonth[$candidate] ?? 0) + 1;

                return $booked;
            }
        }

        return null;
    }

    /**
     * Book the vehicle in on the quietest open day left in the month, if
     * there is one.
     */
    private function book(Vehicle $vehicle, ChecklistTemplate $template, CarbonImmutable $month, CarbonImmutable $today): ?PlannedInspection
    {
        $day = $this->quietestDay($month->startOfMonth()->max($today), $month->endOfMonth());

        if ($day === null) {
            return null;
        }

        $this->load[$day->toDateString()] += $this->weightOf($template);

        return PlannedInspection::create([
            'vehicle_id' => $vehicle->id,
            'template' => $template,
            'period' => PlannedInspection::periodFor($template, $day),
            'due_on' => $day->toDateString(),
        ]);
    }

    /**
     * Pick the open day between the two dates with the least work booked on
     * it, weekdays before Saturdays and the earliest on a tie.
     */
    private function quietestDay(CarbonImmutable $from, CarbonImmutable $until): ?CarbonImmutable
    {
        $this->countMonth($from);

        $open = collect();

        for ($day = $from->startOfDay(); $day->lessThanOrEqualTo($until); $day = $day->addDay()) {
            if (ClosedDay::isOpenOn($day, $this->closed)) {
                $open->push($day);
            }
        }

        $weekdays = $open->reject(fn (CarbonImmutable $day): bool => $day->isSaturday());

        return ($weekdays->isNotEmpty() ? $weekdays : $open)
            ->sortBy(fn (CarbonImmutable $day): array => [$this->load[$day->toDateString()], $day->timestamp])
            ->first();
    }

    /**
     * Add up the work already booked on each day of the month.
     */
    private function countMonth(CarbonImmutable $month): void
    {
        $startOfMonth = $month->startOfMonth();
        $endOfMonth = $month->endOfMonth();

        if (isset($this->countedMonths[$startOfMonth->format('Y-m')])) {
            return;
        }

        $this->countedMonths[$startOfMonth->format('Y-m')] = true;

        for ($day = $startOfMonth; $day->lessThanOrEqualTo($endOfMonth); $day = $day->addDay()) {
            $this->load[$day->toDateString()] = 0;
        }

        $range = [$startOfMonth->toDateString(), $endOfMonth->toDateString()];

        PlannedInspection::query()
            ->where('skipped', false)
            ->whereBetween('due_on', $range)
            ->get()
            ->each(function (PlannedInspection $planned): void {
                $this->load[$planned->due_on->toDateString()] += $this->weightOf($planned->template);
            });

        ServiceRecord::query()
            ->bookedBetween(...$range)
            ->where('status', '!=', ServiceStatus::Completed)
            ->get(['id', 'performed_on', 'scheduled_days', 'finishes_on'])
            ->flatMap(fn (ServiceRecord $job): array => $job->days())
            ->filter(fn (string $day): bool => $day >= $range[0] && $day <= $range[1])
            ->each(function (string $day): void {
                $this->load[$day] += self::WEIGHT_JOB;
            });
    }

    /**
     * Get how much of a day a check takes up.
     */
    private function weightOf(ChecklistTemplate $template): int
    {
        return $template === ChecklistTemplate::AnnualInspection
            ? self::WEIGHT_ANNUAL_INSPECTION
            : self::WEIGHT_MONTHLY_CHECK;
    }
}
