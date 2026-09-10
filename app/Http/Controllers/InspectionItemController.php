<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Models\InspectionItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class InspectionItemController extends Controller
{
    /**
     * Mark a single checklist item off.
     */
    public function update(Request $request, InspectionItem $inspectionItem): RedirectResponse
    {
        Gate::authorize('update', $inspectionItem->inspection);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(CheckStatus::class)],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $inspectionItem->update($validated);

        return back();
    }
}
