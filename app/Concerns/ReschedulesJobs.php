<?php

namespace App\Concerns;

use App\Models\ClosedDay;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Changes the days a job on a schedule is booked on: either every day at
 * once, picked by hand, or by moving one of its days somewhere else, which
 * moves the rest by as much. A move does not put the job's other days on
 * a day the shop is closed without saying so; the day picked has already
 * been asked about.
 */
trait ReschedulesJobs
{
    /**
     * Book the job on the days the request asks for.
     *
     * @param  Model&BooksDays  $job
     *
     * @throws ValidationException
     */
    private function reschedule(Request $request, Model $job): void
    {
        $validated = $request->validate([
            'days' => ['sometimes', 'array', 'min:1', 'max:31'],
            'days.*' => ['required', 'date', 'distinct'],
            'performed_on' => ['required_without:days', 'date'],
            'day' => ['nullable', 'date', Rule::in($job->days())],
            'on_closed_days' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['days'])) {
            $job->bookOn($validated['days'])->save();

            return;
        }

        $days = $job->daysMovedBy($validated['day'] ?? $job->days()[0], $validated['performed_on']);

        if (! $request->boolean('on_closed_days')) {
            $this->ensureOpenOn($days, Carbon::parse($validated['performed_on'])->toDateString());
        }

        $job->bookOn($days)->save();
    }

    /**
     * Describe the days a job is booked on for a toast: one day, or its
     * first and last.
     *
     * @param  Model&BooksDays  $job
     */
    private function bookedDates(Model $job): string
    {
        return $job->finishes_on === null
            ? $job->performed_on->format('D j M')
            : $job->performed_on->format('D j M').' – '.$job->finishes_on->format('D j M');
    }

    /**
     * Stop a job's days landing on days the shop is closed, all but the one
     * picked for it.
     *
     * @param  array<int, string>  $days
     *
     * @throws ValidationException
     */
    private function ensureOpenOn(array $days, string $picked): void
    {
        $closed = ClosedDay::between(Carbon::parse($days[0]), Carbon::parse(end($days)));

        $closedOn = collect($days)
            ->reject(fn (string $day): bool => $day === $picked)
            ->reject(fn (string $day): bool => ClosedDay::isOpenOn(Carbon::parse($day), $closed));

        if ($closedOn->isNotEmpty()) {
            throw ValidationException::withMessages([
                'closed_days' => __('The shop is closed on :days, which this job would move onto as well.', [
                    'days' => $closedOn->map(fn (string $day): string => Carbon::parse($day)->format('D j M'))->join(', ', ' and '),
                ]),
            ]);
        }
    }
}
