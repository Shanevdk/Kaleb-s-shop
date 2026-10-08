<?php

namespace App\Http\Controllers;

use App\Actions\StoreOptimizedImage;
use App\Http\Requests\EquipmentPhotoRequest;
use App\Models\Equipment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class EquipmentPhotoController extends Controller
{
    /**
     * Add photos of the equipment, after the ones it already has.
     *
     * The photos are shrunk before the row is locked, so two uploads at
     * once each add theirs without holding the other up for long.
     */
    public function store(EquipmentPhotoRequest $request, Equipment $equipment, StoreOptimizedImage $storeOptimizedImage): RedirectResponse
    {
        $added = collect($request->file('photos'))
            ->map(fn (UploadedFile $photo): string|false => $storeOptimizedImage->handle($photo, "equipment/{$equipment->id}"))
            ->filter()
            ->values()
            ->all();

        if ($added === []) {
            throw ValidationException::withMessages([
                'photos' => __('Those photos could not be saved. Try again.'),
            ]);
        }

        DB::transaction(function () use ($equipment, $added): void {
            $locked = Equipment::query()->lockForUpdate()->findOrFail($equipment->id);

            $locked->update(['photos' => [...($locked->photos ?? []), ...$added]]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => count($added) === 1
            ? __('Photo added.')
            : __(':count photos added.', ['count' => count($added)])]);

        return back();
    }

    /**
     * Throw away one of the equipment's photos, named by its file name.
     */
    public function destroy(Equipment $equipment, string $photo): RedirectResponse
    {
        Gate::authorize('update', $equipment);

        $removed = DB::transaction(function () use ($equipment, $photo): ?string {
            $locked = Equipment::query()->lockForUpdate()->findOrFail($equipment->id);
            $photos = $locked->photos ?? [];
            $path = collect($photos)->first(fn (string $path): bool => basename($path) === $photo);

            if ($path !== null) {
                $locked->update(['photos' => array_values(array_diff($photos, [$path]))]);
            }

            return $path;
        });

        if ($removed !== null) {
            Storage::disk('public')->delete($removed);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo removed.')]);

        return back();
    }
}
