<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Requests\ScheduleJobRequest;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ScheduleJobController extends Controller
{
    /**
     * Put a job on the schedule. It lands in the service log as planned
     * work, so the mechanics pick it up from there.
     */
    public function store(ScheduleJobRequest $request): RedirectResponse
    {
        $request->user()->serviceRecords()->create([
            ...$request->validated(),
            'status' => ServiceStatus::Planned,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job added to the schedule.')]);

        return back();
    }

    /**
     * Move a job that is not finished yet to another day.
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
        ]);

        $serviceRecord->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved to :date.', [
            'date' => $serviceRecord->performed_on->format('D j M'),
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
