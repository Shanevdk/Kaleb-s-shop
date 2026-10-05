<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Requests\ScheduleJobRequest;
use App\Models\ClosedDay;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ScheduleJobController extends Controller
{
    /**
     * Put a job on the schedule, on one day or several. It lands in the
     * service log as planned work, so the mechanics pick it up from there.
     */
    public function store(ScheduleJobRequest $request): RedirectResponse
    {
        $job = $request->user()->serviceRecords()->make([
            ...$request->safe()->except('days'),
            'status' => ServiceStatus::Planned,
        ]);

        $job->bookOn($request->validated('days'))->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job added to the schedule.')]);

        return back();
    }

    /**
     * Move a job that is not finished yet to another day. Moving any one day
     * of a job over several days (its first, unless another is given) moves
     * the rest by as much. The other days are not put on a day the shop is
     * closed without saying so; the day picked has already been asked about.
     */
    public function update(Request $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        if ($serviceRecord->status === ServiceStatus::Completed) {
            throw ValidationException::withMessages([
                'performed_on' => __('A finished job stays on the day it was done.'),
            ]);
        }

        $validated = $request->validate([
            'performed_on' => ['required', 'date'],
            'day' => ['nullable', 'date', Rule::in($serviceRecord->days())],
            'on_closed_days' => ['sometimes', 'boolean'],
        ]);

        $days = $serviceRecord->daysMovedBy($validated['day'] ?? $serviceRecord->days()[0], $validated['performed_on']);

        if (! $request->boolean('on_closed_days')) {
            $this->ensureOpenOn($days, Carbon::parse($validated['performed_on'])->toDateString());
        }

        $serviceRecord->bookOn($days)->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved to :date.', [
            'date' => $serviceRecord->finishes_on === null
                ? $serviceRecord->performed_on->format('D j M')
                : $serviceRecord->performed_on->format('D j M').' – '.$serviceRecord->finishes_on->format('D j M'),
        ])]);

        return back();
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

    /**
     * Take a job nobody has started off the schedule.
     */
    public function destroy(ServiceRecord $serviceRecord): RedirectResponse
    {
        if ($serviceRecord->status !== ServiceStatus::Planned) {
            throw ValidationException::withMessages([
                'job' => __('Only a job nobody has started can come off the schedule.'),
            ]);
        }

        $serviceRecord->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job taken off the schedule.')]);

        return back();
    }
}
