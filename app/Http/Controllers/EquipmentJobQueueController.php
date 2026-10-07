<?php

namespace App\Http\Controllers;

use App\Enums\EquipmentDivision;
use App\Enums\EquipmentServiceType;
use App\Enums\ServiceStatus;
use App\Http\Resources\EquipmentServiceRecordResource;
use App\Models\Equipment;
use App\Models\EquipmentServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentJobQueueController extends Controller
{
    /**
     * Display the division's own job queue: every equipment job under way
     * or coming up soon, plus what was finished recently. Kept apart from
     * the vehicle jobs on Kaleb's Shop's queue and from the other
     * division's.
     */
    public function index(EquipmentDivision $division): Response
    {
        $jobs = EquipmentServiceRecord::query()
            ->inDivision($division)
            ->with('equipment')
            ->onJobQueue()
            ->orderBy('performed_on')
            ->orderBy('created_at')
            ->get();

        return Inertia::render('equipment-job-queue/index', [
            'division' => $division->value,
            'jobs' => EquipmentServiceRecordResource::collection($jobs)->resolve(),
            'equipment' => Equipment::options($division),
        ]);
    }

    /**
     * Quickly add a job for one of the division's machines straight to its
     * queue. It lands as planned work of no particular type today, to be
     * filled in later from the service log. The machine can be left for
     * later too.
     */
    public function store(Request $request, EquipmentDivision $division): RedirectResponse
    {
        $validated = $request->validate([
            'equipment_id' => ['nullable', 'string', Rule::exists('equipment', 'id')->where('division', $division->value)],
            'title' => ['required', 'string', 'max:120'],
        ]);

        $request->user()->equipmentServiceRecords()->make([
            ...$validated,
            'division' => $division,
            'type' => EquipmentServiceType::Other,
            'status' => ServiceStatus::Planned,
        ])->bookOn([today()->toDateString()])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job added to the queue.')]);

        return back();
    }

    /**
     * Move a job to another column on the board.
     */
    public function update(Request $request, EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        Gate::authorize('update', $equipmentServiceRecord);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(ServiceStatus::class)],
        ]);

        $equipmentServiceRecord->moveOnQueue(ServiceStatus::from($validated['status']))->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':title moved to :status.', [
            'title' => $equipmentServiceRecord->title,
            'status' => $equipmentServiceRecord->status->label(),
        ])]);

        return back();
    }
}
