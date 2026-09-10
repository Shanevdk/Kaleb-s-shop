<?php

namespace App\Http\Controllers;

use App\Actions\SyncServiceRecordStock;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Enums\UnitOfMeasure;
use App\Http\Requests\ServiceRecordRequest;
use App\Http\Resources\ServiceRecordResource;
use App\Models\Fitment;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ServiceRecordController extends Controller
{
    public function __construct(private SyncServiceRecordStock $syncServiceRecordStock) {}

    /**
     * Display the full service log.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));
        $status = (string) $request->string('status');
        $vehicleId = (string) $request->string('vehicle');

        if ($vehicleId !== '' && ! $request->user()->vehicles()->whereKey($vehicleId)->exists()) {
            $vehicleId = '';
        }

        if (! ServiceStatus::tryFrom($status) instanceof ServiceStatus) {
            $status = '';
        }

        $records = $request->user()->serviceRecords()
            ->with('vehicle')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->when(ServiceStatus::tryFrom($status), fn ($query, ServiceStatus $status) => $query->where('status', $status))
            ->when($vehicleId !== '', fn ($query) => $query->where('vehicle_id', $vehicleId))
            ->latest('performed_on')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('service-records/index', [
            'records' => ServiceRecordResource::collection($records->getCollection())->resolve(),
            'pagination' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'total' => $records->total(),
                'prev_page_url' => $records->previousPageUrl(),
                'next_page_url' => $records->nextPageUrl(),
            ],
            'vehicles' => $this->vehicleOptions($request),
            'statuses' => ServiceStatus::options(),
            'filters' => [
                'search' => $search,
                'status' => $status,
                'vehicle' => $vehicleId,
            ],
        ]);
    }

    /**
     * Show the form for logging a new job.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('service-records/create', [
            'vehicles' => $this->vehicleOptions($request),
            'types' => ServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'units' => UnitOfMeasure::catalog(),
            'stockedParts' => $this->stockedParts($request),
            'selectedVehicle' => (string) $request->string('vehicle'),
        ]);
    }

    /**
     * Store a newly logged job.
     */
    public function store(ServiceRecordRequest $request): RedirectResponse
    {
        $record = $request->user()->serviceRecords()->create($request->recordAttributes());

        $this->syncParts($record, $request->parts());

        $this->flashStockResult($record, __('Job logged.'));

        return to_route('service-records.index');
    }

    /**
     * Show the form for editing a logged job.
     */
    public function edit(Request $request, ServiceRecord $serviceRecord): Response
    {
        Gate::authorize('update', $serviceRecord);

        return Inertia::render('service-records/edit', [
            'record' => ServiceRecordResource::make($serviceRecord->load('parts.inventoryItem'))->resolve(),
            'vehicles' => $this->vehicleOptions($request),
            'types' => ServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'units' => UnitOfMeasure::catalog(),
            'stockedParts' => $this->stockedParts($request),
        ]);
    }

    /**
     * Update the given job.
     */
    public function update(ServiceRecordRequest $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        $serviceRecord->update($request->recordAttributes());

        $this->syncParts($serviceRecord, $request->parts());

        $this->flashStockResult($serviceRecord, __('Job updated.'));

        return to_route('service-records.index');
    }

    /**
     * Remove the given job.
     */
    public function destroy(ServiceRecord $serviceRecord): RedirectResponse
    {
        Gate::authorize('delete', $serviceRecord);

        $this->syncServiceRecordStock->release($serviceRecord, $serviceRecord->parts()->get());

        $serviceRecord->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job removed. Anything it took is back on the shelf.')]);

        return back();
    }

    /**
     * Take what the job used off the shelf and say what happened, warning
     * rather than succeeding quietly when the shelf could not cover a part.
     */
    private function flashStockResult(ServiceRecord $serviceRecord, string $message): void
    {
        $short = $this->syncServiceRecordStock->handle($serviceRecord);

        if ($short === []) {
            Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

            return;
        }

        Inertia::flash('toast', [
            'type' => 'warning',
            'message' => __('Job saved, but there was not enough :parts on the shelf. The shortfall is on the shopping list.', [
                'parts' => implode(', ', $short),
            ]),
        ]);
    }

    /**
     * Get every stocked part with the vehicles it fits, so the job form can
     * suggest what the chosen vehicle usually needs.
     *
     * @return array<int, array{id: string, name: string, part_number: string|null, unit: string, unit_abbreviation: string, quantity: float, fits: array<int, array{vehicle_id: string, quantity_needed: float}>}>
     */
    private function stockedParts(Request $request): array
    {
        return $request->user()->inventoryItems()
            ->with('fitments')
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryItem $item): array => [
                'id' => $item->id,
                'name' => $item->name,
                'part_number' => $item->part_number,
                'unit' => $item->unit->value,
                'unit_abbreviation' => $item->unit->abbreviation(),
                'quantity' => (float) $item->quantity,
                'fits' => $item->fitments
                    ->map(fn (Fitment $fitment): array => [
                        'vehicle_id' => $fitment->vehicle_id,
                        'quantity_needed' => (float) $fitment->quantity_needed,
                    ])
                    ->all(),
            ])
            ->all();
    }

    /**
     * Line the parts the job calls for up with what was submitted, keeping
     * how much of each line has already come off the shelf, and put back
     * anything a dropped line had taken.
     *
     * @param  array<int, array{id: string|null, inventory_item_id: string|null, name: string, quantity: float, unit: string}>  $parts
     */
    private function syncParts(ServiceRecord $serviceRecord, array $parts): void
    {
        $keptIds = [];

        foreach ($parts as $part) {
            $existing = $part['id'] === null
                ? null
                : $serviceRecord->parts()->find($part['id']);

            $attributes = Arr::except($part, ['id']);

            if ($existing === null) {
                $keptIds[] = $serviceRecord->parts()->create($attributes)->id;

                continue;
            }

            $existing->update($attributes);
            $keptIds[] = $existing->id;
        }

        $dropped = $serviceRecord->parts()->whereNotIn('_id', $keptIds)->get();

        $this->syncServiceRecordStock->release($serviceRecord, $dropped);

        $dropped->each(fn (ServiceRecordPart $part) => $part->delete());
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
