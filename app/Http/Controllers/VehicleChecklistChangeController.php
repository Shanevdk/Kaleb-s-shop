<?php

namespace App\Http\Controllers;

use App\Enums\ChecklistTemplate;
use App\Models\Vehicle;
use App\Models\VehicleChecklistChange;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class VehicleChecklistChangeController extends Controller
{
    /**
     * Put a vehicle's copy of a checklist back to the standard list,
     * forgetting every check added to it or left out of it.
     */
    public function destroy(Vehicle $vehicle, ChecklistTemplate $template): RedirectResponse
    {
        Gate::authorize('update', $vehicle);

        VehicleChecklistChange::query()->forChecklist($vehicle->id, $template)->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('The :checklist for this vehicle is back to the standard list.', [
                'checklist' => mb_strtolower($template->label()),
            ]),
        ]);

        return back();
    }
}
