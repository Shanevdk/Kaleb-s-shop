<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Requests\EquipmentScheduleJobRequest;
use App\Models\EquipmentServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class EquipmentScheduleJobController extends Controller
{
    /**
     * Put maintenance on the equipment schedule. It lands in the equipment
     * service log as planned work.
     */
    public function store(EquipmentScheduleJobRequest $request): RedirectResponse
    {
        $request->user()->equipmentServiceRecords()->create([
            ...$request->validated(),
            'status' => ServiceStatus::Planned,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance added to the schedule.')]);

        return back();
    }

    /**
     * Move maintenance that is not finished yet to another day.
     */
    public function update(Request $request, EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        if ($equipmentServiceRecord->status === ServiceStatus::Completed) {
            throw ValidationException::withMessages([
                'performed_on' => __('Finished maintenance stays on the day it was done.'),
            ]);
        }

        $validated = $request->validate([
            'performed_on' => ['required', 'date'],
        ]);

        $equipmentServiceRecord->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved to :date.', [
            'date' => $equipmentServiceRecord->performed_on->format('D j M'),
        ])]);

        return back();
    }

    /**
     * Take maintenance nobody has started off the schedule.
     */
    public function destroy(EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
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
