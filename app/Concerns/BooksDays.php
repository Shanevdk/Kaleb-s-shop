<?php

namespace App\Concerns;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Lets a job be booked over one day or several. The first day is kept in
 * performed_on; a job over more than one day also keeps every day it is
 * booked on in scheduled_days, and the last in finishes_on so a calendar
 * can find it.
 *
 * @property Carbon $performed_on
 * @property array<int, string>|null $scheduled_days
 * @property Carbon|null $finishes_on
 */
trait BooksDays
{
    /**
     * Moving the first day of a job over several days on its own moves the
     * rest of its days with it, so the job keeps its shape.
     */
    public static function bootBooksDays(): void
    {
        static::saving(function (self $job): void {
            if ($job->scheduled_days === null || ! $job->isDirty('performed_on') || $job->isDirty('scheduled_days')) {
                return;
            }

            $job->bookOn($job->daysMovedBy($job->getOriginal('performed_on'), $job->performed_on));
        });
    }

    /**
     * Book the job on the given days. The first becomes the day it is done
     * on; a job over more than one day remembers the rest as well.
     *
     * @param  array<int, string>  $days
     */
    public function bookOn(array $days): static
    {
        $days = collect($days)
            ->map(fn (string $day): string => Carbon::parse($day)->toDateString())
            ->unique()
            ->sort()
            ->values();

        $this->performed_on = $days->first();
        $this->scheduled_days = $days->count() > 1 ? $days->all() : null;
        $this->finishes_on = $days->count() > 1 ? $days->last() : null;

        return $this;
    }

    /**
     * Get every day the job is booked on, in order.
     *
     * @return array<int, string>
     */
    public function days(): array
    {
        return $this->scheduled_days ?? [$this->performed_on->toDateString()];
    }

    /**
     * Bring the job's days up to the day it was finished: days booked after
     * it are dropped, and a job that was not due to start until later is
     * done on that day instead.
     */
    public function finishedOn(CarbonInterface|string $day): static
    {
        $day = Carbon::parse($day)->toDateString();
        $worked = array_values(array_filter($this->days(), fn (string $booked): bool => $booked <= $day));

        return $this->bookOn($worked === [] ? [$day] : $worked);
    }

    /**
     * Get the job's days with every one of them moved as far as it takes to
     * get from one date to the other.
     *
     * @return array<int, string>
     */
    public function daysMovedBy(CarbonInterface|string $from, CarbonInterface|string $to): array
    {
        $moved = (int) Carbon::parse($from)->diffInDays(Carbon::parse($to), false);

        return array_map(
            fn (string $day): string => Carbon::parse($day)->addDays($moved)->toDateString(),
            $this->days(),
        );
    }

    /**
     * Limit to jobs booked on any day between the two dates.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function bookedBetween(Builder $query, string $from, string $to): void
    {
        $query->where('performed_on', '<=', $to)->bookedFrom($from);
    }

    /**
     * Limit to jobs booked on any day from the date onwards.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function bookedFrom(Builder $query, string $from): void
    {
        $query->where(fn (Builder $query) => $query
            ->where('finishes_on', '>=', $from)
            ->orWhere(fn (Builder $query) => $query
                ->whereNull('finishes_on')
                ->where('performed_on', '>=', $from)));
    }
}
