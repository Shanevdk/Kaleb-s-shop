<?php

namespace App\Http\Controllers;

use App\Enums\CheckStatus;
use App\Http\Requests\VehicleRequest;
use App\Http\Resources\InspectionResource;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\ServiceRecordResource;
use App\Http\Resources\VehicleResource;
use App\Models\Fitment;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class VehicleController extends Controller
{
    /**
     * Display the fleet belonging to the current user.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));

        $vehicles = $request->user()->vehicles()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('make', 'like', "%{$search}%")
                        ->orWhere('model', 'like', "%{$search}%")
                        ->orWhere('nickname', 'like', "%{$search}%")
                        ->orWhere('registration', 'like', "%{$search}%");
                });
            })
            ->orderBy('make')
            ->orderBy('model')
            ->get();

        $this->attachServiceTotals($request, $vehicles);

        return Inertia::render('vehicles/index', [
            'vehicles' => VehicleResource::collection($vehicles)->resolve(),
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Show the form for adding a vehicle.
     */
    public function create(): Response
    {
        return Inertia::render('vehicles/create');
    }

    /**
     * Store a newly added vehicle.
     */
    public function store(VehicleRequest $request): RedirectResponse
    {
        $vehicle = $request->user()->vehicles()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Vehicle added.')]);

        return to_route('vehicles.show', $vehicle);
    }

    /**
     * Display a single vehicle, its full service history and every checklist
     * ever run against it.
     */
    public function show(Vehicle $vehicle): Response
    {
        Gate::authorize('view', $vehicle);

        $records = $vehicle->serviceRecords()
            ->latest('performed_on')
            ->latest('id')
            ->get();

        $inspections = $vehicle->inspections()
            ->latest('performed_on')
            ->latest('id')
            ->get();

        $this->attachCheckTallies($inspections);

        $fitments = $vehicle->fitments()
            ->with('inventoryItem')
            ->get()
            ->filter(fn (Fitment $fitment): bool => $fitment->inventoryItem !== null)
            ->sortBy(fn (Fitment $fitment): string => $fitment->inventoryItem->name)
            ->values();

        return Inertia::render('vehicles/show', [
            'vehicle' => VehicleResource::make($vehicle)->resolve(),
            'records' => ServiceRecordResource::collection($records)->resolve(),
            'parts' => $fitments
                ->map(fn (Fitment $fitment): array => [
                    ...InventoryItemResource::make($fitment->inventoryItem)->resolve(),
                    'quantity_needed' => (float) $fitment->quantity_needed,
                    'fitment_notes' => $fitment->notes,
                    'shortfall' => round(max(0, (float) $fitment->quantity_needed - (float) $fitment->inventoryItem->quantity), 2),
                ])
                ->all(),
            'inspections' => InspectionResource::collection($inspections)->resolve(),
            'stats' => [
                'records' => $records->count(),
                'hours' => round((float) $records->sum(fn (ServiceRecord $record): float => (float) $record->hours), 2),
                'spend' => round((float) $records->sum(fn (ServiceRecord $record): float => $record->total_cost), 2),
                'open' => $records->reject(fn (ServiceRecord $record): bool => $record->status->isCompleted())->count(),
                'needs_attention' => $inspections->sum(fn (Inspection $inspection): int => (int) $inspection->getAttribute('flagged_count')),
            ],
        ]);
    }

    /**
     * Put the good, needs attention and fixed tallies on each checklist.
     *
     * MongoDB cannot join, so `withCount` is not available: the items are
     * pulled back in one go and counted by hand.
     *
     * @param  Collection<int, Inspection>  $inspections
     */
    private function attachCheckTallies(Collection $inspections): void
    {
        $items = InspectionItem::query()
            ->whereIn('inspection_id', $inspections->map(fn (Inspection $inspection): string => $inspection->id)->all())
            ->get(['inspection_id', 'status'])
            ->groupBy('inspection_id');

        foreach ($inspections as $inspection) {
            /** @var Collection<int, InspectionItem> $own */
            $own = $items->get($inspection->id, new Collection);

            $inspection->setAttribute('items_count', $own->count());
            $inspection->setAttribute('checked_count', $own->filter(fn (InspectionItem $item): bool => $item->status->isChecked())->count());
            $inspection->setAttribute('flagged_count', $own->filter(fn (InspectionItem $item): bool => $item->status->needsWork())->count());
            $inspection->setAttribute('fixed_count', $own->filter(fn (InspectionItem $item): bool => $item->status === CheckStatus::Fixed)->count());
        }
    }

    /**
     * Show the form for editing a vehicle.
     */
    public function edit(Vehicle $vehicle): Response
    {
        Gate::authorize('update', $vehicle);

        return Inertia::render('vehicles/edit', [
            'vehicle' => VehicleResource::make($vehicle)->resolve(),
        ]);
    }

    /**
     * Update the given vehicle.
     */
    public function update(VehicleRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $vehicle->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Vehicle updated.')]);

        return to_route('vehicles.show', $vehicle);
    }

    /**
     * Remove the given vehicle and its service history.
     */
    public function destroy(Vehicle $vehicle): RedirectResponse
    {
        Gate::authorize('delete', $vehicle);

        $vehicle->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Vehicle removed.')]);

        return to_route('vehicles.index');
    }

    /**
     * Put the job count and spend on each vehicle.
     *
     * MongoDB cannot join, so `withCount` and `withSum` are not available:
     * the user's service records are pulled back once and rolled up by hand.
     *
     * @param  Collection<int, Vehicle>  $vehicles
     */
    private function attachServiceTotals(Request $request, Collection $vehicles): void
    {
        $records = $request->user()->serviceRecords()
            ->get(['vehicle_id', 'parts_cost', 'labour_cost', 'performed_on'])
            ->groupBy('vehicle_id');

        foreach ($vehicles as $vehicle) {
            /** @var Collection<int, ServiceRecord> $own */
            $own = $records->get($vehicle->id, new Collection);

            $vehicle->setAttribute('service_records_count', $own->count());
            $vehicle->setAttribute('parts_spend', $own->sum(fn (ServiceRecord $record): float => (float) $record->parts_cost));
            $vehicle->setAttribute('labour_spend', $own->sum(fn (ServiceRecord $record): float => (float) $record->labour_cost));
            $vehicle->setAttribute(
                'last_serviced_on',
                $own->max(fn (ServiceRecord $record): string => $record->performed_on->toDateString()),
            );
        }
    }
}
