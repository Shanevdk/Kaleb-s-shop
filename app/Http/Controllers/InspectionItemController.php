<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Jobs\PlanRepairForFlaggedItem;
use App\Models\Inspection;
use App\Models\InspectionItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class InspectionItemController extends Controller
{
    /**
     * Add a check to the checklist. Unless it is for this checklist only, it
     * is remembered for the vehicle and goes on its next checklist of the
     * same kind too.
     */
    public function store(Request $request, Inspection $inspection): RedirectResponse
    {
        Gate::authorize('update', $inspection);

        $section = trim((string) $request->input('section')) ?: Inspection::EXTRA_SECTION;

        $validated = $request->validate([
            'section' => ['nullable', 'string', 'max:255'],
            'label' => [
                'required',
                'string',
                'max:255',
                Rule::unique('inspection_items')->where('inspection_id', $inspection->id)->where('section', $section),
            ],
            'remember' => ['boolean'],
        ], [
            'label.required' => __('Say what needs checking.'),
            'label.unique' => __('That check is already on the list.'),
        ]);

        $remember = $request->boolean('remember', true);

        $inspection->addCheck($section, $validated['label'], $remember);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $remember
                ? __('Check added, and remembered for this vehicle.')
                : __('Check added to this checklist.'),
        ]);

        return back();
    }

    /**
     * Take a check off the checklist. Unless it is for this checklist only,
     * it stays off the vehicle's next checklist of the same kind too.
     */
    public function destroy(Request $request, InspectionItem $inspectionItem): RedirectResponse
    {
        Gate::authorize('update', $inspectionItem->inspection);

        $remember = $request->boolean('remember', true);

        $inspectionItem->inspection->removeCheck($inspectionItem, $remember);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $remember
                ? __('Check removed, and left off for this vehicle.')
                : __('Check removed from this checklist.'),
        ]);

        return back();
    }

    /**
     * Mark a single checklist item off.
     *
     * Flagging an item for attention sets about planning its repair and the
     * parts it needs; unflagging it throws away a repair nobody has started.
     */
    public function update(Request $request, InspectionItem $inspectionItem): RedirectResponse
    {
        Gate::authorize('update', $inspectionItem->inspection);

        $validated = $request->validate([
            'status' => ['sometimes', 'required', Rule::enum(CheckStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $wasFlagged = $inspectionItem->status === CheckStatus::Attention;

        $inspectionItem->update($validated);

        $isFlagged = $inspectionItem->status === CheckStatus::Attention;

        if ($isFlagged && ! $wasFlagged) {
            $this->planRepair($request, $inspectionItem);
        }

        if ($wasFlagged && ! $isFlagged) {
            $inspectionItem->discardPlannedRepair();
            $inspectionItem->update(['parts_status' => null]);
        }

        return back();
    }

    /**
     * Work out the parts for a flagged item again, after a failed attempt or
     * once a note says more about what is wrong.
     */
    public function replan(Request $request, InspectionItem $inspectionItem): RedirectResponse
    {
        Gate::authorize('update', $inspectionItem->inspection);

        if ($inspectionItem->status !== CheckStatus::Attention) {
            throw ValidationException::withMessages([
                'status' => __('Only an item flagged for attention needs parts.'),
            ]);
        }

        $this->planRepair($request, $inspectionItem);

        return back();
    }

    /**
     * Mark the item as waiting on its parts and hand the work to the job.
     */
    private function planRepair(Request $request, InspectionItem $inspectionItem): void
    {
        $inspectionItem->markAwaitingParts();

        PlanRepairForFlaggedItem::dispatch($inspectionItem, $request->user());
    }
}
