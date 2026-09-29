<?php

namespace App\Actions;

use App\Enums\ChecklistTemplate;
use App\Enums\ServiceStatus;
use App\Models\PlannedInspection;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Books every vehicle in for its monthly check and its annual inspection,
 * spreading the work over the weekdays so no one day gets swamped.
 *
 * Running it again only fills gaps: anything already booked, or moved by
 * hand, stays where it is.
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

            DB::transaction(fn () => $this->plan($startOfMonth, $today));
        });
    }

    /**
     * Fill in the month's gaps, vehicle by vehicle.
     */
    private function plan(CarbonImmutable $startOfMonth, CarbonImmutable $today): void
    {
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
            $annual = $booked->get("{$vehicle->id}|".ChecklistTemplate::AnnualInspection->value)
                ?? $this->book($vehicle, ChecklistTemplate::AnnualInspection, $this->quietestMonth($startOfMonth, $today), $today);

            $monthly = $booked->get("{$vehicle->id}|".ChecklistTemplate::MonthlyCheck->value);

            // The annual inspection covers the monthly check for its month.
            if ($annual->due_on->isSameMonth($startOfMonth)) {
                $monthly?->delete();

                continue;
            }

            if ($monthly === null) {
                $this->book($vehicle, ChecklistTemplate::MonthlyCheck, $startOfMonth, $today);
            }
        }
    }

    /**
     * Book the vehicle in on the quietest weekday left in the month.
     */
    private function book(Vehicle $vehicle, ChecklistTemplate $template, CarbonImmutable $month, CarbonImmutable $today): PlannedInspection
    {
        $day = $this->quietestDay($month->startOfMonth()->max($today), $month->endOfMonth());

        $this->load[$day->toDateString()] += $template === ChecklistTemplate::AnnualInspection
            ? self::WEIGHT_ANNUAL_INSPECTION
            : self::WEIGHT_MONTHLY_CHECK;

        if ($template === ChecklistTemplate::AnnualInspection) {
            $this->annualsPerMonth[$day->month] = ($this->annualsPerMonth[$day->month] ?? 0) + 1;
        }

        return PlannedInspection::create([
            'vehicle_id' => $vehicle->id,
            'template' => $template,
            'period' => PlannedInspection::periodFor($template, $day),
            'due_on' => $day->toDateString(),
        ]);
    }

    /**
     * Pick the month still to come this year with the fewest annual
     * inspections in it, so they spread across the year.
     */
    private function quietestMonth(CarbonImmutable $month, CarbonImmutable $today): CarbonImmutable
    {
        $firstMonth = $month->year === $today->year ? $today->month : 1;

        $quietest = collect(range($firstMonth, 12))
            ->sortBy(fn (int $candidate): array => [$this->annualsPerMonth[$candidate] ?? 0, $candidate])
            ->first();

        return $month->setDate($month->year, $quietest, 1);
    }

    /**
     * Pick the day between the two dates with the least work booked on it,
     * weekdays first and the earliest on a tie.
     */
    private function quietestDay(CarbonImmutable $from, CarbonImmutable $until): CarbonImmutable
    {
        $this->countMonth($from);

        $days = collect();

        for ($day = $from->startOfDay(); $day->lessThanOrEqualTo($until); $day = $day->addDay()) {
            $days->push($day);
        }

        $weekdays = $days->reject(fn (CarbonImmutable $day): bool => $day->isWeekend());

        return ($weekdays->isNotEmpty() ? $weekdays : $days)
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
            ->whereBetween('due_on', $range)
            ->get()
            ->each(function (PlannedInspection $planned): void {
                $this->load[$planned->due_on->toDateString()] += $planned->template === ChecklistTemplate::AnnualInspection
                    ? self::WEIGHT_ANNUAL_INSPECTION
                    : self::WEIGHT_MONTHLY_CHECK;
            });

        ServiceRecord::query()
            ->whereBetween('performed_on', $range)
            ->where('status', '!=', ServiceStatus::Completed)
            ->pluck('performed_on')
            ->each(function (CarbonInterface $performedOn): void {
                $this->load[$performedOn->toDateString()] += self::WEIGHT_JOB;
            });
    }
}
