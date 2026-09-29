<?php

namespace App\Http\Controllers;

use App\Actions\PlanInspectionSchedule;
use App\Enums\ChecklistTemplate;
use App\Models\PlannedInspection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PlannedInspectionController extends Controller
{
    /**
     * Move a booked check to another day. It has to stay inside the month (or
     * for the annual inspection, the year) it covers.
     */
    public function update(Request $request, PlannedInspection $plannedInspection, PlanInspectionSchedule $planSchedule): RedirectResponse
    {
        $validated = $request->validate([
            'due_on' => [
                'required',
                'date',
                'after_or_equal:'.$plannedInspection->windowStart()->max(today())->toDateString(),
                'before_or_equal:'.$plannedInspection->windowEnd()->toDateString(),
            ],
        ]);

        $movedFrom = $plannedInspection->due_on;

        $plannedInspection->update(['due_on' => $validated['due_on']]);

        // Moving the annual inspection to another month hands the monthly
        // check back to the month it left and takes it from the one it joined.
        if ($plannedInspection->template === ChecklistTemplate::AnnualInspection && ! $movedFrom->isSameMonth($plannedInspection->due_on)) {
            $planSchedule->handle($movedFrom);
            $planSchedule->handle($plannedInspection->due_on);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved to :date.', [
            'date' => $plannedInspection->due_on->format('D j M'),
        ])]);

        return back();
    }
}
