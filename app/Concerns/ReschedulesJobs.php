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
 * moves the rest by as much. Nothing new lands on a day the shop is closed
 * without saying so first. The day a job is dragged onto has already been
 * asked about, and the days it was booked on already stand.
 */
trait ReschedulesJobs
{
    use ValidatesBookedDays;

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
            ...self::bookedDaysRules(required: false),
            'performed_on' => ['required_without:days', 'date'],
            'day' => ['nullable', 'date', Rule::in($job->days())],
            'on_closed_days' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['days'])) {
            $days = $validated['days'];
            $alreadyAsked = $job->days();
        } else {
            $days = $job->daysMovedBy($validated['day'] ?? $job->days()[0], $validated['performed_on']);
            $alreadyAsked = [Carbon::parse($validated['performed_on'])->toDateString()];
        }

        $job->bookOn($days);

        if (! $request->boolean('on_closed_days')) {
            $this->ensureOpenOn($job->days(), $alreadyAsked);
        }

        $job->save();
    }

    /**
     * Describe the days a job is booked on for a toast.
     *
     * @param  Model&BooksDays  $job
     */
    private function bookedDates(Model $job): string
    {
        $days = collect($job->days())->map(fn (string $day): string => Carbon::parse($day)->format('D j M'));

        return $days->count() > 4
            ? __(':count days, :first to :last', ['count' => $days->count(), 'first' => $days->first(), 'last' => $days->last()])
            : $days->join(', ', ' and ');
    }

    /**
     * Stop a job's days landing on days the shop is closed, apart from the
     * ones already asked about.
     *
     * @param  array<int, string>  $days
     * @param  array<int, string>  $alreadyAsked
     *
     * @throws ValidationException
     */
    private function ensureOpenOn(array $days, array $alreadyAsked): void
    {
        $closed = ClosedDay::between(Carbon::parse($days[0]), Carbon::parse(end($days)));

        $closedOn = collect($days)
            ->reject(fn (string $day): bool => in_array($day, $alreadyAsked, true))
            ->reject(fn (string $day): bool => ClosedDay::isOpenOn(Carbon::parse($day), $closed));

        if ($closedOn->isNotEmpty()) {
            throw ValidationException::withMessages([
                'closed_days' => __('The shop is closed on :days.', [
                    'days' => $closedOn->map(fn (string $day): string => Carbon::parse($day)->format('D j M'))->join(', ', ' and '),
                ]),
            ]);
        }
    }
}
