<?php

namespace App\Concerns;

use App\Enums\ScheduledCheckStatus;
use App\Enums\ServiceStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Puts jobs booked over one day or several on a month's calendar, the same
 * way on every schedule.
 */
trait PutsJobsOnCalendar
{
    /**
     * Work out where a job stands. One not yet started is due on each day it
     * is booked on, and overdue on any other day once its first day has gone
     * by.
     *
     * @param  Model&BooksDays  $job
     */
    private function jobStatus(Model $job, CarbonImmutable $today): ScheduledCheckStatus
    {
        $days = $job->days();

        return match (true) {
            $job->status === ServiceStatus::Completed => ScheduledCheckStatus::Done,
            $job->status === ServiceStatus::InProgress => ScheduledCheckStatus::InProgress,
            in_array($today->toDateString(), $days, true) => ScheduledCheckStatus::Due,
            $days[0] < $today->toDateString() => ScheduledCheckStatus::Overdue,
            default => ScheduledCheckStatus::Upcoming,
        };
    }

    /**
     * Keep the jobs with a day in the month, and give each of them an entry on
     * every one of its days that falls in it. The jobs count once each in the
     * month's stats; the entries go on the calendar.
     *
     * @param  Collection<int, array<string, mixed>>  $jobs  entries with every day the job is booked on as 'days'
     * @return array{0: Collection<int, array<string, mixed>>, 1: Collection<int, array<string, mixed>>}
     */
    private function jobsInMonth(Collection $jobs, CarbonImmutable $startOfMonth): array
    {
        $daysInMonth = fn (array $job): array => array_values(array_filter(
            $job['days'],
            fn (string $day): bool => str_starts_with($day, $startOfMonth->format('Y-m')),
        ));

        $jobs = $jobs->filter(fn (array $job): bool => $daysInMonth($job) !== [])->values();

        $entries = $jobs->flatMap(fn (array $job): array => array_map(
            fn (string $day): array => [...$job, 'date' => $day],
            $daysInMonth($job),
        ));

        return [$jobs, $entries];
    }
}
