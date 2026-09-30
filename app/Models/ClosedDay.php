<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ClosedDayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A day the shop has been marked shut, on top of Sundays and the Ontario
 * statutory holidays, which are worked out rather than stored.
 *
 * @property string $id
 * @property CarbonImmutable $date
 * @property string $reason
 * @property string|null $user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['date', 'reason'])]
class ClosedDay extends Model
{
    /** @use HasFactory<ClosedDayFactory> */
    use HasFactory, HasUlids;

    /**
     * Get every day the shop is shut between the two dates, apart from
     * Sundays, with the reason it is shut.
     *
     * @return array<string, array{reason: string, id: string|null}> keyed by date
     */
    public static function between(CarbonInterface $from, CarbonInterface $until): array
    {
        $closed = [];

        foreach (range($from->year, $until->year) as $year) {
            foreach (self::ontarioHolidays($year) as $date => $name) {
                if ($date >= $from->toDateString() && $date <= $until->toDateString()) {
                    $closed[$date] = ['reason' => $name, 'id' => null];
                }
            }
        }

        self::query()
            ->whereBetween('date', [$from->toDateString(), $until->toDateString()])
            ->get()
            ->each(function (ClosedDay $day) use (&$closed): void {
                $closed[$day->date->toDateString()] ??= ['reason' => $day->reason, 'id' => $day->id];
            });

        ksort($closed);

        return $closed;
    }

    /**
     * Determine whether the shop is open on the day, given the closed days
     * from {@see between()}.
     *
     * @param  array<string, mixed>  $closed
     */
    public static function isOpenOn(CarbonInterface $day, array $closed): bool
    {
        return ! $day->isSunday() && ! isset($closed[$day->toDateString()]);
    }

    /**
     * Get Ontario's statutory holidays for the year, plus the weekday off in
     * lieu when a fixed-date one falls on a weekend.
     *
     * @return array<string, string> the holiday's name keyed by date
     */
    public static function ontarioHolidays(int $year): array
    {
        $easter = self::easterSunday($year);
        $victoriaDay = CarbonImmutable::create($year, 5, 24);

        $holidays = [
            CarbonImmutable::create($year, 2, 1)->nthOfMonth(3, CarbonInterface::MONDAY)->toDateString() => 'Family Day',
            $easter->subDays(2)->toDateString() => 'Good Friday',
            ($victoriaDay->isMonday() ? $victoriaDay : $victoriaDay->previous(CarbonInterface::MONDAY))->toDateString() => 'Victoria Day',
            CarbonImmutable::create($year, 9, 1)->nthOfMonth(1, CarbonInterface::MONDAY)->toDateString() => 'Labour Day',
            CarbonImmutable::create($year, 10, 1)->nthOfMonth(2, CarbonInterface::MONDAY)->toDateString() => 'Thanksgiving',
        ];

        $fixed = [
            [1, 1, "New Year's Day"],
            [7, 1, 'Canada Day'],
            [12, 25, 'Christmas Day'],
            [12, 26, 'Boxing Day'],
        ];

        foreach ($fixed as [$month, $day, $name]) {
            $holidays[CarbonImmutable::create($year, $month, $day)->toDateString()] = $name;
        }

        foreach ($fixed as [$month, $day, $name]) {
            $date = CarbonImmutable::create($year, $month, $day);

            if (! $date->isWeekend()) {
                continue;
            }

            $inLieu = $date->next(CarbonInterface::MONDAY);

            while (isset($holidays[$inLieu->toDateString()]) || $inLieu->isWeekend()) {
                $inLieu = $inLieu->addDay();
            }

            $holidays[$inLieu->toDateString()] = "{$name} (observed)";
        }

        ksort($holidays);

        return $holidays;
    }

    /**
     * Work out Easter Sunday with the anonymous Gregorian algorithm.
     */
    private static function easterSunday(int $year): CarbonImmutable
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $monthAndDay = $h + $l - 7 * $m + 114;

        return CarbonImmutable::create($year, intdiv($monthAndDay, 31), ($monthAndDay % 31) + 1);
    }

    /**
     * Get the person who marked the day shut.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'immutable_date',
        ];
    }
}
