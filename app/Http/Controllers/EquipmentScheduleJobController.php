<?php

namespace App\Http\Controllers;

use App\Concerns\ReschedulesJobs;
use App\Enums\ServiceStatus;
use App\Http\Requests\EquipmentScheduleJobRequest;
use App\Models\EquipmentServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class EquipmentScheduleJobController extends Controller
{
    use ReschedulesJobs;

    /**
     * Put maintenance on the equipment schedule, on one day or several. It
     * lands in the equipment service log as planned work.
     */
    public function store(EquipmentScheduleJobRequest $request): RedirectResponse
    {
        $job = $request->user()->equipmentServiceRecords()->make([
            ...$request->safe()->except('days'),
            'status' => ServiceStatus::Planned,
        ]);

        $job->bookOn($request->validated('days'))->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance added to the schedule.')]);

        return back();
    }

    /**
     * Change the days maintenance that is not finished yet is booked on.
     */
    public function update(Request $request, EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        Gate::authorize('update', $equipmentServiceRecord);

        if ($equipmentServiceRecord->status === ServiceStatus::Completed) {
            throw ValidationException::withMessages([
                'performed_on' => __('Finished maintenance stays on the day it was done.'),
            ]);
        }

        $this->reschedule($request, $equipmentServiceRecord);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Booked on :date.', [
            'date' => $this->bookedDates($equipmentServiceRecord),
        ])]);

        return back();
    }

    /**
     * Take maintenance nobody has started off the schedule.
     */
    public function destroy(EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        Gate::authorize('delete', $equipmentServiceRecord);

        if ($equipmentServiceRecord->status !== ServiceStatus::Planned) {
            throw ValidationException::withMessages([
                'job' => __('Only maintenance nobody has started can come off the schedule.'),
            ]);
        }

        $equipmentServiceRecord->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance taken off the schedule.')]);

        return back();
    }
}
