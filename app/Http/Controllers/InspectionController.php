<?php

namespace App\Http\Controllers;

use App\Enums\ChecklistTemplate;
use App\Enums\CheckStatus;
use App\Http\Requests\InspectionRequest;
use App\Http\Resources\InspectionResource;
use App\Models\Inspection;
use App\Models\InspectionItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class InspectionController extends Controller
{
    /**
     * Display every checklist the user has run.
     */
    public function index(Request $request): Response
    {
        $vehicleId = (string) $request->string('vehicle');

        if (! $this->isDocumentId($vehicleId)) {
            $vehicleId = '';
        }

        $inspections = $request->user()->inspections()
            ->with('vehicle')
            ->when($vehicleId !== '', fn ($query) => $query->where('vehicle_id', $vehicleId))
            ->latest('performed_on')
            ->latest('id')
            ->get();

        $this->attachItemCounts($inspections);

        return Inertia::render('inspections/index', [
            'inspections' => InspectionResource::collection($inspections)->resolve(),
            'vehicles' => $this->vehicleOptions($request),
            'filters' => ['vehicle' => $vehicleId],
        ]);
    }

    /**
     * Show the vehicle and checklist picker.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('inspections/create', [
            'vehicles' => $this->vehicleOptions($request),
            'templates' => ChecklistTemplate::catalog(),
            'selectedVehicle' => (string) $request->string('vehicle'),
        ]);
    }

    /**
     * Start a checklist and build its items from the chosen template.
     */
    public function store(InspectionRequest $request): RedirectResponse
    {
        $template = ChecklistTemplate::from($request->validated('template'));

        $inspection = $request->user()->inspections()->create([
            ...$request->validated(),
            'title' => $template->label(),
        ]);

        $inspection->fillFromTemplate();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist started.')]);

        return to_route('inspections.show', $inspection);
    }

    /**
     * Display a checklist and everything left to check.
     */
    public function show(Inspection $inspection): Response
    {
        Gate::authorize('view', $inspection);

        $inspection->load(['vehicle', 'items']);

        return Inertia::render('inspections/show', [
            'inspection' => InspectionResource::make($inspection)->resolve(),
            'statuses' => CheckStatus::options(),
        ]);
    }

    /**
     * Update the checklist notes or sign it off.
     */
    public function update(Request $request, Inspection $inspection): RedirectResponse
    {
        Gate::authorize('update', $inspection);

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'completed' => ['required', 'boolean'],
        ]);

        $inspection->update([
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
    public function destroy(Inspection $inspection): RedirectResponse
    {
        Gate::authorize('delete', $inspection);

        $inspection->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist removed.')]);

        return to_route('inspections.index');
    }

    /**
     * Put the checked and flagged tallies on each checklist.
     *
     * MongoDB cannot join, so `withCount` is not available: the items are
     * pulled back in one go and counted by hand.
     *
     * @param  Collection<int, Inspection>  $inspections
     */
    private function attachItemCounts(Collection $inspections): void
    {
        $items = InspectionItem::query()
            ->whereIn('inspection_id', $inspections->modelKeys())
            ->get(['inspection_id', 'status'])
            ->groupBy('inspection_id');

        foreach ($inspections as $inspection) {
            /** @var Collection<int, InspectionItem> $own */
            $own = $items->get($inspection->id, new Collection);

            $inspection->setAttribute('items_count', $own->count());
            $inspection->setAttribute(
                'checked_count',
                $own->reject(fn (InspectionItem $item): bool => $item->status === CheckStatus::Pending)->count(),
            );
            $inspection->setAttribute(
                'flagged_count',
                $own->filter(fn (InspectionItem $item): bool => $item->status->needsWork())->count(),
            );
            $inspection->setAttribute(
                'fixed_count',
                $own->filter(fn (InspectionItem $item): bool => $item->status === CheckStatus::Fixed)->count(),
            );
        }
    }

    /**
     * Get the vehicles owned by the current user as select options.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function vehicleOptions(Request $request): array
    {
        return $request->user()->vehicles()
            ->orderBy('make')
            ->orderBy('model')
            ->get()
            ->map(fn ($vehicle): array => [
                'value' => (string) $vehicle->id,
                'label' => $vehicle->display_name,
            ])
            ->all();
    }
}
