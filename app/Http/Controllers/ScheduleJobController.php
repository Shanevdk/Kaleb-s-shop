<?php

namespace App\Http\Controllers;

use App\Concerns\ReschedulesJobs;
use App\Enums\ServiceStatus;
use App\Http\Requests\ScheduleJobRequest;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ScheduleJobController extends Controller
{
    use ReschedulesJobs;

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
     * Change the days a job that is not finished yet is booked on.
     */
    public function update(Request $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        if ($serviceRecord->status === ServiceStatus::Completed) {
            throw ValidationException::withMessages([
                'performed_on' => __('A finished job stays on the day it was done.'),
            ]);
        }

        $this->reschedule($request, $serviceRecord);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved to :date.', [
            'date' => $this->bookedDates($serviceRecord),
        ])]);

        return back();
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
