<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentChecklistItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class EquipmentChecklistItemController extends Controller
{
    /**
     * Add a check to the end of the checklist.
     */
    public function store(Request $request, EquipmentChecklist $equipmentChecklist): RedirectResponse
    {
        Gate::authorize('update', $equipmentChecklist);

        $validated = $request->validate([
            'label' => [
                'required',
                'string',
                'max:255',
                Rule::unique('equipment_checklist_items')->where('equipment_checklist_id', $equipmentChecklist->id),
            ],
        ], [
            'label.required' => __('Say what needs checking.'),
            'label.unique' => __('That check is already on the list.'),
        ]);

        $equipmentChecklist->addCheck($validated['label']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Check added.')]);

        return back();
    }

    /**
     * Mark a single checklist item off.
     */
    public function update(Request $request, EquipmentChecklistItem $equipmentChecklistItem): RedirectResponse
    {
        Gate::authorize('update', $equipmentChecklistItem->equipmentChecklist);

        $validated = $request->validate([
            'status' => ['sometimes', 'required', Rule::enum(CheckStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $equipmentChecklistItem->update($validated);

        return back();
    }

    /**
     * Take a check off the checklist.
     */
    public function destroy(EquipmentChecklistItem $equipmentChecklistItem): RedirectResponse
    {
        Gate::authorize('update', $equipmentChecklistItem->equipmentChecklist);

        $equipmentChecklistItem->delete();

        return back();
    }
}
