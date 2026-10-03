<?php

namespace App\Http\Controllers;

use App\Actions\DecodeVin;
use App\Actions\FetchRecalls;
use App\Enums\MachineKind;
use App\Enums\PhotoAngle;
use App\Enums\VehicleCategory;
use App\Http\Requests\VehicleRequest;
use App\Http\Resources\InspectionResource;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\ServiceRecordResource;
use App\Http\Resources\VehicleResource;
use App\Models\Fitment;
use App\Models\Inspection;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        $vehicles = Vehicle::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->whereLike('make', "%{$search}%")
                        ->orWhereLike('model', "%{$search}%")
                        ->orWhereLike('nickname', "%{$search}%")
                        ->orWhereLike('registration', "%{$search}%");
                });
            })
            ->withCount('serviceRecords')
            ->withSum('serviceRecords as parts_spend', 'parts_cost')
            ->withSum('serviceRecords as labour_spend', 'labour_cost')
            ->withMax('serviceRecords as last_serviced_on', 'performed_on')
            ->orderBy('make')
            ->orderBy('model')
            ->get();

        return Inertia::render('vehicles/index', [
            'vehicles' => VehicleResource::collection($vehicles)->resolve(),
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Show the form for adding a vehicle.
     *
     * The lookup page hands over what it decoded from a VIN in the query
     * string so the form starts filled in.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('vehicles/create', [
            'prefill' => $request->only(['vin', 'make', 'model', 'year', 'kind', 'cylinders', 'displacement_l', 'fuel']),
            'kinds' => MachineKind::options(),
            'categories' => VehicleCategory::options(),
        ]);
    }

    /**
     * Store a newly added vehicle.
     */
    public function store(VehicleRequest $request, DecodeVin $decoder): RedirectResponse
    {
        $vehicle = $request->user()->vehicles()->create(
            $this->withSpecs($request->validated(), null, $decoder),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Vehicle added.')]);

        return to_route('vehicles.show', $vehicle);
    }

    /**
     * Fold the decoded VIN and any hand-typed engine details into the
     * attributes about to be saved.
     *
     * The decoder is only asked when the VIN is new or has changed; a saved
     * decode is kept otherwise. Whatever the person typed for the engine wins
     * over the decoder, since they can see the thing and it cannot.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function withSpecs(array $validated, ?Vehicle $existing, DecodeVin $decoder): array
    {
        $vin = DecodeVin::normalise($validated['vin'] ?? null);
        $validated['vin'] = $vin !== '' ? $vin : null;

        $kept = $existing?->specs;
        $sameVin = $existing !== null && DecodeVin::normalise($existing->vin) === $vin;

        $specs = $sameVin && ($kept['source'] ?? null) === 'nhtsa'
            ? $kept
            : ($decoder->handle($vin) ?? ['source' => 'manual', 'engine' => []]);

        foreach (['cylinders', 'displacement_l', 'fuel'] as $field) {
            if (array_key_exists($field, $validated)) {
                if ($validated[$field] !== null && $validated[$field] !== '') {
                    $specs['engine'][$field] = $field === 'fuel'
                        ? (string) $validated[$field]
                        : ($field === 'cylinders' ? (int) $validated[$field] : round((float) $validated[$field], 2));
                } elseif (($specs['source'] ?? null) === 'manual') {
                    unset($specs['engine'][$field]);
                }
            }

            unset($validated[$field]);
        }

        $validated['kind'] = $validated['kind']
            ?? $specs['kind']
            ?? $existing?->kind->value
            ?? MachineKind::Other->value;
        $validated['specs'] = $specs;

        return $validated;
    }

    /**
     * Display a single vehicle, its full service history and every checklist
     * ever run against it.
     */
    public function show(Vehicle $vehicle, FetchRecalls $recalls): Response
    {
        Gate::authorize('view', $vehicle);

        $kind = $vehicle->machineKind();

        $records = $vehicle->serviceRecords()
            ->latest('performed_on')
            ->latest('id')
            ->get();

        $inspections = $vehicle->inspections()
            ->withCheckTallies()
            ->latest('performed_on')
            ->latest('id')
            ->get();

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
            'photo_angles' => PhotoAngle::catalog(),
            'maintenance' => $kind->maintenanceSchedule($vehicle->engine()['fuel']),
            'repairs' => $kind->commonRepairs(),
            'recalls' => Inertia::defer(fn (): array => $kind === MachineKind::Trailer
                ? []
                : $recalls->handle($vehicle->make, $vehicle->model, $vehicle->year)),
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
     * Show the form for editing a vehicle.
     */
    public function edit(Vehicle $vehicle): Response
    {
        Gate::authorize('update', $vehicle);

        return Inertia::render('vehicles/edit', [
            'vehicle' => VehicleResource::make($vehicle)->resolve(),
            'kinds' => MachineKind::options(),
            'categories' => VehicleCategory::options(),
        ]);
    }

    /**
     * Update the given vehicle.
     */
    public function update(VehicleRequest $request, Vehicle $vehicle, DecodeVin $decoder): RedirectResponse
    {
        $vehicle->update($this->withSpecs($request->validated(), $vehicle, $decoder));

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
}
