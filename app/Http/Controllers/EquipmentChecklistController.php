<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Http\Resources\EquipmentChecklistResource;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentChecklistController extends Controller
{
    /**
     * Start a checklist against a piece of equipment.
     */
    public function store(Request $request, Equipment $equipment): RedirectResponse
    {
        Gate::authorize('update', $equipment);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'performed_on' => ['required', 'date'],
        ]);

        $checklist = $request->user()->equipmentChecklists()->create([
            ...$validated,
            'equipment_id' => $equipment->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist started.')]);

        return to_route('equipment-checklists.show', $checklist);
    }

    /**
     * Display a checklist and everything left to check.
     */
    public function show(EquipmentChecklist $equipmentChecklist): Response
    {
        Gate::authorize('view', $equipmentChecklist);

        $equipmentChecklist->load(['equipment', 'items']);

        return Inertia::render('equipment-checklists/show', [
            'checklist' => EquipmentChecklistResource::make($equipmentChecklist)->resolve(),
            'statuses' => CheckStatus::options(),
        ]);
    }

    /**
     * Update the checklist notes or sign it off.
     */
    public function update(Request $request, EquipmentChecklist $equipmentChecklist): RedirectResponse
    {
        Gate::authorize('update', $equipmentChecklist);

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'completed' => ['required', 'boolean'],
        ]);

        $equipmentChecklist->update([
            'notes' => $validated['notes'] ?? null,
            'completed_at' => $validated['completed'] ? now() : null,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $validated['completed'] ? __('Checklist signed off.') : __('Checklist reopened.'),
        ]);

        return back();
    }

    /**
     * Remove the given checklist.
     */
    public function destroy(EquipmentChecklist $equipmentChecklist): RedirectResponse
    {
        Gate::authorize('delete', $equipmentChecklist);

        $equipment = $equipmentChecklist->equipment;

        $equipmentChecklist->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist removed.')]);

        return to_route('equipment.show', $equipment);
    }
}
