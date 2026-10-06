<?php

namespace App\Concerns;

use App\Enums\ServiceStatus;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;

/**
 * Lets a job sit on a job queue board and be moved between its columns.
 * Used together with BooksDays.
 *
 * @property ServiceStatus $status
 */
trait SitsOnJobQueue
{
    /**
     * How many days a finished job stays on the board after its last day,
     * so the queue does not fill up with old finished work.
     */
    public const QUEUE_KEEPS_FINISHED_DAYS = 14;

    /**
     * How far ahead a job not yet started has to be booked to show on the
     * board. Anything later waits on the schedule, so today's work is not
     * buried under bookings months out.
     */
    public const QUEUE_LOOKS_AHEAD_DAYS = 14;

    /**
     * Limit to the jobs the board shows: everything under way, what is not
     * started and coming up soon, and what was finished recently.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function onJobQueue(Builder $query): void
    {
        $query->where(fn (Builder $query) => $query
            ->where('status', ServiceStatus::InProgress)
            ->orWhere(fn (Builder $query) => $query
                ->where('status', ServiceStatus::Planned)
                ->where('performed_on', '<=', today()->addDays(self::QUEUE_LOOKS_AHEAD_DAYS)->toDateString()))
            ->orWhere(fn (Builder $query) => $query
                ->where('status', ServiceStatus::Completed)
                ->bookedFrom(today()->subDays(self::QUEUE_KEEPS_FINISHED_DAYS)->toDateString())));
    }

    /**
     * Move the job to another column. A job finished from the board is
     * finished by today, so it is not left completed on a day still to come.
     */
    public function moveOnQueue(ServiceStatus $status): static
    {
        if ($status === ServiceStatus::Completed && $this->status !== ServiceStatus::Completed) {
            $this->finishedOn(today());
        }

        $this->status = $status;

        return $this;
    }
}
