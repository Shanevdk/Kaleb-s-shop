<?php

namespace App\Http\Controllers;

use App\Actions\SyncServiceRecordStock;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Enums\UnitOfMeasure;
use App\Http\Requests\ServiceRecordRequest;
use App\Http\Resources\ServiceRecordResource;
use App\Http\Resources\WorkOrderResource;
use App\Models\Fitment;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
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

        if ($vehicleId !== '' && ! Vehicle::query()->whereKey($vehicleId)->exists()) {
            $vehicleId = '';
        }

        if (! ServiceStatus::tryFrom($status) instanceof ServiceStatus) {
            $status = '';
        }

        $records = ServiceRecord::query()
            ->with('vehicle')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->whereLike('title', "%{$search}%")
                        ->orWhereLike('description', "%{$search}%");
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
            'vehicles' => Vehicle::options(),
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
            'vehicles' => Vehicle::options(),
            'types' => ServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'units' => UnitOfMeasure::catalog(),
            'stockedParts' => $this->stockedParts($request),
            'selectedVehicle' => (string) $request->string('vehicle'),
        ]);
    }

    /**
     * Store a newly logged job.
     *
     * The job, its parts and the stock they take are saved together, so a
     * failure part way leaves nothing half done.
     */
    public function store(ServiceRecordRequest $request): RedirectResponse
    {
        $user = $request->user();

        $short = DB::transaction(function () use ($request, $user): array {
            $record = $user->serviceRecords()->make($request->recordAttributes());
            $record->bookOn($request->days())->save();

            $this->syncParts($record, $request->parts(), $user);

            return $this->syncServiceRecordStock->handle($record, $user);
        });

        $this->flashStockResult($short, __('Job logged.'));

        return to_route('service-records.index');
    }

    /**
     * Display the full detail for a logged job.
     */
    public function show(ServiceRecord $serviceRecord): Response
    {
        Gate::authorize('view', $serviceRecord);

        return Inertia::render('service-records/show', [
            'record' => ServiceRecordResource::make($serviceRecord->load('vehicle', 'parts.inventoryItem', 'inspectionItem'))->resolve(),
            'workOrder' => [
                'url' => $serviceRecord->workOrderUrl(),
                'sheet' => WorkOrderResource::make($serviceRecord)->resolve(),
            ],
        ]);
    }

    /**
     * Show the form for editing a logged job.
     */
    public function edit(Request $request, ServiceRecord $serviceRecord): Response
    {
        Gate::authorize('update', $serviceRecord);

        return Inertia::render('service-records/edit', [
            'record' => ServiceRecordResource::make($serviceRecord->load('parts.inventoryItem'))->resolve(),
            'vehicles' => Vehicle::options(),
            'types' => ServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'units' => UnitOfMeasure::catalog(),
            'stockedParts' => $this->stockedParts($request),
        ]);
    }

    /**
     * Update the given job.
     *
     * The job, its parts and the stock they take are saved together, so a
     * failure part way leaves nothing half done.
     */
    public function update(ServiceRecordRequest $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        $user = $request->user();

        $short = DB::transaction(function () use ($request, $serviceRecord, $user): array {
            $serviceRecord->fill($request->recordAttributes())->bookOn($request->days())->save();

            $partsBefore = $this->partsFingerprint($serviceRecord);

            $this->syncParts($serviceRecord, $request->parts(), $user);

            if ($this->partsFingerprint($serviceRecord) !== $partsBefore) {
                $serviceRecord->estimateAgain();
            }

            return $this->syncServiceRecordStock->handle($serviceRecord, $user);
        });

        $this->flashStockResult($short, __('Job updated.'));

        return to_route('service-records.index');
    }

    /**
     * Remove the given job.
     *
     * Redirects to the service log instead of back when the request came
     * from the job's own page: going back there would send the browser to
     * a record that no longer exists. Deleting from the log itself goes
     * back to preserve its search, status, vehicle and page filters.
     */
    public function destroy(Request $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        Gate::authorize('delete', $serviceRecord);

        $cameFromOwnPage = $request->headers->get('referer') === route('service-records.show', $serviceRecord);

        DB::transaction(function () use ($request, $serviceRecord): void {
            $this->syncServiceRecordStock->release($serviceRecord, $serviceRecord->parts()->get(), $request->user());

            $serviceRecord->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job removed. Anything it took is back on the shelf.')]);

        return $cameFromOwnPage ? to_route('service-records.index') : back();
    }

    /**
     * Say how taking what the job used off the shelf went, warning rather
     * than succeeding quietly when the shelf could not cover a part.
     *
     * @param  array<int, string>  $short
     */
    private function flashStockResult(array $short, string $message): void
    {
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
        return InventoryItem::query()
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
     * A line switched to a different stocked part, or to none, puts what it
     * took back on the old part first, so the stock is then taken from the
     * new one instead.
     *
     * @param  array<int, array{id: string|null, inventory_item_id: string|null, name: string, quantity: float, unit: string}>  $parts
     */
    private function syncParts(ServiceRecord $serviceRecord, array $parts, ?User $actingUser): void
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

            if ($attributes['inventory_item_id'] !== $existing->inventory_item_id) {
                $this->syncServiceRecordStock->release($serviceRecord, [$existing], $actingUser);
            }

            $existing->update($attributes);
            $keptIds[] = $existing->id;
        }

        $dropped = $serviceRecord->parts()->whereNotIn('id', $keptIds)->get();

        $this->syncServiceRecordStock->release($serviceRecord, $dropped, $actingUser);

        $dropped->each(fn (ServiceRecordPart $part) => $part->delete());
    }

    /**
     * Get a fingerprint of which parts the job calls for and how many, so a
     * change to them can be told apart from a save that left them alone.
     */
    private function partsFingerprint(ServiceRecord $serviceRecord): string
    {
        return md5((string) json_encode(
            $serviceRecord->parts()
                ->orderBy('id')
                ->get(['name', 'quantity', 'unit', 'inventory_item_id'])
                ->map(fn (ServiceRecordPart $part): array => [$part->name, $part->quantity, $part->unit->value, $part->inventory_item_id])
                ->all(),
        ));
    }
}
