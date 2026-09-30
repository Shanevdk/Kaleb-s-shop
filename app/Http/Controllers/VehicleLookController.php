<?php

namespace App\Http\Controllers;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\StudyVehiclePhotos;
use App\Http\Requests\StudyVehiclePhotosRequest;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class VehicleLookController extends Controller
{
    /**
     * Have the AI study the vehicle's photos, so the 3D model can be matched
     * to what it sees.
     */
    public function store(StudyVehiclePhotosRequest $request, Vehicle $vehicle, StudyVehiclePhotos $study): JsonResponse
    {
        // Free models can take their time, and a slow one hands over to the
        // next, so give the request longer than PHP's usual minute.
        set_time_limit(180);

        try {
            $study->handle($vehicle);
        } catch (AssistantUnavailable $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        return response()->json(['look' => $vehicle->lookForDisplay()]);
    }

    /**
     * Forget what the AI made of the photos and go back to the plain model.
     */
    public function destroy(Vehicle $vehicle): RedirectResponse
    {
        Gate::authorize('update', $vehicle);

        $vehicle->update(['look' => null]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('The model is back to how it was.')]);

        return back();
    }
}
