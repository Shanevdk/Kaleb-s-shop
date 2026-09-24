<?php

namespace App\Http\Controllers;

use App\Enums\PhotoAngle;
use App\Http\Requests\VehiclePhotoRequest;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class VehiclePhotoController extends Controller
{
    /**
     * Keep a photo of the vehicle from one of the set angles, replacing
     * whatever was there for that angle.
     */
    public function store(VehiclePhotoRequest $request, Vehicle $vehicle, PhotoAngle $angle): RedirectResponse
    {
        $photos = $vehicle->photos ?? [];

        if (isset($photos[$angle->value])) {
            Storage::disk('public')->delete($photos[$angle->value]);
        }

        $photos[$angle->value] = $request->file('photo')->store("vehicles/{$vehicle->id}", 'public');

        $vehicle->update(['photos' => $photos]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':angle photo saved.', ['angle' => $angle->label()])]);

        return back();
    }

    /**
     * Throw away the photo taken from the given angle.
     */
    public function destroy(Vehicle $vehicle, PhotoAngle $angle): RedirectResponse
    {
        Gate::authorize('update', $vehicle);

        $photos = $vehicle->photos ?? [];

        if (isset($photos[$angle->value])) {
            Storage::disk('public')->delete($photos[$angle->value]);
            unset($photos[$angle->value]);
            $vehicle->update(['photos' => $photos]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo removed.')]);

        return back();
    }
}
