<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Enums\RepairPartsStatus;
use App\Jobs\PlanRepairForFlaggedItem;
use App\Models\InspectionItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InspectionItemController extends Controller
{
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
            'status' => ['required', Rule::enum(CheckStatus::class)],
            'notes' => ['nullable', 'string', 'max:255'],
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
        $inspectionItem->update(['parts_status' => RepairPartsStatus::Pending]);

        PlanRepairForFlaggedItem::dispatch($inspectionItem, $request->user());
    }
}
