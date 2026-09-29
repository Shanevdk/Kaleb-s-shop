<?php

namespace App\Actions\Assistant;

use App\Enums\CheckStatus;
use App\Enums\PartCategory;
use App\Enums\ServiceStatus;
use App\Models\Fitment;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

/**
 * The lookups the assistant can make into the shop's records.
 *
 * The records belong to the whole shop, the same as on every other page, and
 * nothing here writes.
 */
class ShopTools
{
    /**
     * The most rows a list tool hands back in one go.
     */
    private const MAX_ROWS = 50;

    /**
     * Describe the tools in the shape the chat completions API expects.
     *
     * @return array<int, array{type: string, function: array{name: string, description: string, parameters: array<string, mixed>}}>
     */
    public function definitions(): array
    {
        $vehicleId = ['type' => 'string', 'description' => 'The id of a vehicle, as returned by list_vehicles.'];

        return [
            $this->tool('shop_summary', 'Get the headline numbers: vehicle count, open jobs, spend and hours overall and this month, parts low on stock, stock value and checklist items needing attention.'),
            $this->tool('list_vehicles', 'List every vehicle and machine in the fleet with its id, identity, odometer, job count, total spend and last service date. Use this to find a vehicle id from a name, make, model or registration.'),
            $this->tool('get_vehicle', 'Get everything about one vehicle: specs, notes, full service history with parts used, recent checklists, items flagged for attention, the stocked parts that fit it and recent stock taken for it.', [
                'vehicle_id' => $vehicleId,
            ], ['vehicle_id']),
            $this->tool('list_jobs', 'List service jobs (service records), newest first, with costs, hours and parts. Filter by status, vehicle, text or date range.', [
                'status' => ['type' => 'string', 'enum' => array_map(fn (ServiceStatus $status): string => $status->value, ServiceStatus::cases())],
                'vehicle_id' => $vehicleId,
                'search' => ['type' => 'string', 'description' => 'Text to look for in the job title or description.'],
                'from' => ['type' => 'string', 'description' => 'Only jobs on or after this date, YYYY-MM-DD.'],
                'to' => ['type' => 'string', 'description' => 'Only jobs on or before this date, YYYY-MM-DD.'],
                'limit' => ['type' => 'integer', 'description' => 'How many jobs to return, up to 50. Defaults to 20.'],
            ]),
            $this->tool('search_parts', 'Search the parts inventory: stock on hand, reorder point, cost, location, barcode and which vehicles each part fits. Leave search empty to list everything.', [
                'search' => ['type' => 'string', 'description' => 'Text to look for in the part name, part number, barcode, brand, supplier or location.'],
                'category' => ['type' => 'string', 'enum' => array_map(fn (PartCategory $category): string => $category->value, PartCategory::cases())],
                'low_stock_only' => ['type' => 'boolean', 'description' => 'Only parts at or below their reorder point.'],
            ]),
            $this->tool('list_issues', 'List checklist items that were flagged as needing attention and not yet fixed, with the vehicle, checklist and notes.', [
                'vehicle_id' => $vehicleId,
            ]),
            $this->tool('stock_history', 'List stock taken off or put back on the shelf, newest first, with the part, vehicle, job and note.', [
                'part_id' => ['type' => 'string', 'description' => 'The id of a part, as returned by search_parts.'],
                'vehicle_id' => $vehicleId,
                'limit' => ['type' => 'integer', 'description' => 'How many movements to return, up to 50. Defaults to 20.'],
            ]),
        ];
    }

    /**
     * Run a tool and return what it found.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<mixed>
     */
    public function call(string $name, array $arguments): array
    {
        return match ($name) {
            'shop_summary' => $this->shopSummary(),
            'list_vehicles' => $this->listVehicles(),
            'get_vehicle' => $this->getVehicle($this->string($arguments, 'vehicle_id')),
            'list_jobs' => $this->listJobs($arguments),
            'search_parts' => $this->searchParts($arguments),
            'list_issues' => $this->listIssues($this->string($arguments, 'vehicle_id')),
            'stock_history' => $this->stockHistory($arguments),
            default => ['error' => "There is no tool called {$name}."],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function shopSummary(): array
    {
        $startOfMonth = now()->startOfMonth();
        $thisMonth = ServiceRecord::query()->where('performed_on', '>=', $startOfMonth);
        $items = InventoryItem::query()->get();

        return [
            'today' => now()->toDateString(),
            'vehicles' => Vehicle::query()->count(),
            'jobs' => ServiceRecord::query()->count(),
            'open_jobs' => ServiceRecord::query()
                ->whereIn('status', [ServiceStatus::Planned, ServiceStatus::InProgress])
                ->count(),
            'jobs_this_month' => (clone $thisMonth)->count(),
            'spend_total' => round((float) ServiceRecord::query()->sum('parts_cost') + (float) ServiceRecord::query()->sum('labour_cost'), 2),
            'spend_this_month' => round((float) (clone $thisMonth)->sum('parts_cost') + (float) (clone $thisMonth)->sum('labour_cost'), 2),
            'hours_total' => round((float) ServiceRecord::query()->sum('hours'), 2),
            'parts_stocked' => $items->count(),
            'parts_low_on_stock' => $items->filter(fn (InventoryItem $item): bool => $this->needsReordering($item))->count(),
            'stock_value' => round($items->sum(fn (InventoryItem $item): float => $item->stock_value), 2),
            'checklist_items_needing_attention' => $this->attentionItems()->count(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function listVehicles(): array
    {
        return Vehicle::query()
            ->withCount('serviceRecords')
            ->withSum('serviceRecords as parts_spend', 'parts_cost')
            ->withSum('serviceRecords as labour_spend', 'labour_cost')
            ->withMax('serviceRecords as last_serviced_on', 'performed_on')
            ->orderBy('make')
            ->orderBy('model')
            ->get()
            ->map(fn (Vehicle $vehicle): array => [
                ...$this->vehicle($vehicle),
                'jobs' => (int) $vehicle->getAttribute('service_records_count'),
                'spend' => round((float) $vehicle->getAttribute('parts_spend') + (float) $vehicle->getAttribute('labour_spend'), 2),
                'last_serviced_on' => $vehicle->getAttribute('last_serviced_on'),
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function getVehicle(string $vehicleId): array
    {
        $vehicle = $this->findVehicle($vehicleId);

        if ($vehicle === null) {
            return ['error' => 'No vehicle with that id. Use list_vehicles to find the right one.'];
        }

        $records = $vehicle->serviceRecords()->with('parts')->latest('performed_on')->latest('id')->limit(self::MAX_ROWS)->get();

        return [
            ...$this->vehicle($vehicle),
            'notes' => $vehicle->notes,
            'service_history' => $records->map(fn (ServiceRecord $record): array => $this->job($record, $vehicle))->all(),
            'checklists' => $vehicle->inspections()
                ->withCheckTallies()
                ->latest('performed_on')
                ->limit(10)
                ->get()
                ->map(fn (Inspection $inspection): array => [
                    'id' => $inspection->id,
                    'title' => $inspection->title,
                    'performed_on' => $inspection->performed_on->toDateString(),
                    'signed_off' => $inspection->is_complete,
                    'items' => (int) $inspection->getAttribute('items_count'),
                    'checked' => (int) $inspection->getAttribute('checked_count'),
                    'needing_attention' => (int) $inspection->getAttribute('flagged_count'),
                    'fixed_on_the_day' => (int) $inspection->getAttribute('fixed_count'),
                ])
                ->all(),
            'needs_attention' => $this->listIssues($vehicle->id),
            'parts_that_fit' => $vehicle->fitments()
                ->with('inventoryItem')
                ->get()
                ->map(fn (Fitment $fitment): array => [
                    'part_id' => $fitment->inventory_item_id,
                    'name' => $fitment->inventoryItem->name,
                    'needed_per_job' => (float) $fitment->quantity_needed,
                    'on_hand' => $fitment->inventoryItem->formattedQuantity(),
                    'notes' => $fitment->notes,
                ])
                ->all(),
            'recent_stock_used' => $this->stockHistory(['vehicle_id' => $vehicle->id, 'limit' => 20]),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<int, array<string, mixed>>
     */
    private function listJobs(array $arguments): array
    {
        $status = ServiceStatus::tryFrom($this->string($arguments, 'status'));
        $vehicleId = $this->string($arguments, 'vehicle_id');
        $search = $this->string($arguments, 'search');
        $from = $this->date($arguments, 'from');
        $to = $this->date($arguments, 'to');

        return ServiceRecord::query()
            ->with(['vehicle', 'parts'])
            ->when($status, fn ($query, ServiceStatus $status) => $query->where('status', $status))
            ->when($vehicleId !== '', fn ($query) => $query->where('vehicle_id', $vehicleId))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->whereLike('title', "%{$search}%")
                ->orWhereLike('description', "%{$search}%")))
            ->when($from, fn ($query, Carbon $from) => $query->where('performed_on', '>=', $from->toDateString()))
            ->when($to, fn ($query, Carbon $to) => $query->where('performed_on', '<=', $to->toDateString()))
            ->latest('performed_on')
            ->latest('id')
            ->limit($this->limit($arguments))
            ->get()
            ->map(fn (ServiceRecord $record): array => $this->job($record, $record->vehicle))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<int, array<string, mixed>>
     */
    private function searchParts(array $arguments): array
    {
        $search = $this->string($arguments, 'search');
        $category = PartCategory::tryFrom($this->string($arguments, 'category'));
        $lowStockOnly = ($arguments['low_stock_only'] ?? false) === true;

        return InventoryItem::query()
            ->with('fitments.vehicle')
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('part_number', "%{$search}%")
                ->orWhereLike('barcode', "%{$search}%")
                ->orWhereLike('brand', "%{$search}%")
                ->orWhereLike('supplier', "%{$search}%")
                ->orWhereLike('location', "%{$search}%")))
            ->when($category, fn ($query, PartCategory $category) => $query->where('category', $category))
            ->when($lowStockOnly, fn ($query) => $query->lowStock())
            ->orderBy('name')
            ->limit(self::MAX_ROWS)
            ->get()
            ->map(fn (InventoryItem $item): array => [
                'id' => $item->id,
                'name' => $item->name,
                'category' => $item->category->label(),
                'part_number' => $item->part_number,
                'barcode' => $item->barcode,
                'brand' => $item->brand,
                'supplier' => $item->supplier,
                'location' => $item->location,
                'on_hand' => $item->formattedQuantity(),
                'reorder_at' => $item->formattedQuantity((float) $item->minimum_quantity),
                'needs_reordering' => $this->needsReordering($item),
                'unit_cost' => (float) $item->unit_cost,
                'stock_value' => $item->stock_value,
                'fits' => $item->fitments
                    ->map(fn (Fitment $fitment): array => [
                        'vehicle_id' => $fitment->vehicle_id,
                        'vehicle' => $fitment->vehicle->display_name,
                        'needed_per_job' => (float) $fitment->quantity_needed,
                    ])
                    ->all(),
                'notes' => $item->notes,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function listIssues(string $vehicleId): array
    {
        return $this->attentionItems()
            ->with('inspection.vehicle')
            ->when($vehicleId !== '', fn ($query) => $query->whereHas(
                'inspection',
                fn ($query) => $query->where('vehicle_id', $vehicleId),
            ))
            ->limit(self::MAX_ROWS)
            ->get()
            ->map(fn (InspectionItem $item): array => [
                'vehicle_id' => $item->inspection->vehicle_id,
                'vehicle' => $item->inspection->vehicle->display_name,
                'checklist' => $item->inspection->title,
                'checked_on' => $item->inspection->performed_on->toDateString(),
                'section' => $item->section,
                'item' => $item->label,
                'notes' => $item->notes,
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<int, array<string, mixed>>
     */
    private function stockHistory(array $arguments): array
    {
        $partId = $this->string($arguments, 'part_id');
        $vehicleId = $this->string($arguments, 'vehicle_id');

        return StockMovement::query()
            ->with(['inventoryItem', 'vehicle', 'serviceRecord'])
            ->when($partId !== '', fn ($query) => $query->where('inventory_item_id', $partId))
            ->when($vehicleId !== '', fn ($query) => $query->where('vehicle_id', $vehicleId))
            ->latest()
            ->latest('id')
            ->limit($this->limit($arguments))
            ->get()
            ->map(fn (StockMovement $movement): array => [
                'on' => $movement->created_at?->toDateString(),
                'part' => $movement->inventoryItem->name,
                'change' => $movement->inventoryItem->formattedQuantity((float) $movement->quantity),
                'direction' => (float) $movement->quantity < 0 ? 'taken off the shelf' : 'put back on the shelf',
                'vehicle' => $movement->vehicle?->display_name,
                'job' => $movement->serviceRecord?->title,
                'note' => $movement->note,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function vehicle(Vehicle $vehicle): array
    {
        return [
            'id' => $vehicle->id,
            'name' => $vehicle->display_name,
            'year' => $vehicle->year,
            'make' => $vehicle->make,
            'model' => $vehicle->model,
            'kind' => $vehicle->machineKind()->label(),
            'registration' => $vehicle->registration,
            'vin' => $vehicle->vin,
            'colour' => $vehicle->colour,
            'odometer' => $vehicle->odometer,
            'engine' => $vehicle->engine_summary,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function job(ServiceRecord $record, Vehicle $vehicle): array
    {
        return [
            'id' => $record->id,
            'title' => $record->title,
            'vehicle_id' => $vehicle->id,
            'vehicle' => $vehicle->display_name,
            'type' => $record->type->label(),
            'status' => $record->status->label(),
            'performed_on' => $record->performed_on->toDateString(),
            'odometer' => $record->odometer,
            'hours' => (float) $record->hours,
            'parts_cost' => (float) $record->parts_cost,
            'labour_cost' => (float) $record->labour_cost,
            'total_cost' => $record->total_cost,
            'description' => $record->description === null ? null : Str::limit($record->description, 500),
            'parts' => $record->parts
                ->map(fn (ServiceRecordPart $part): array => [
                    'name' => $part->name,
                    'quantity' => (float) $part->quantity,
                    'unit' => $part->unit->abbreviation(),
                    'taken_from_stock' => (float) $part->quantity_taken,
                ])
                ->all(),
        ];
    }

    /**
     * Determine whether a part that has a reorder point has dropped to it.
     */
    private function needsReordering(InventoryItem $item): bool
    {
        return (float) $item->minimum_quantity > 0 && $item->is_low_stock;
    }

    /**
     * Get the user's checklist items still flagged for attention.
     *
     * @return Builder<InspectionItem>
     */
    private function attentionItems(): Builder
    {
        return InspectionItem::query()
            ->whereIn('inspection_id', Inspection::query()->select('id'))
            ->where('status', CheckStatus::Attention);
    }

    private function findVehicle(string $vehicleId): ?Vehicle
    {
        return $vehicleId === '' ? null : Vehicle::query()->whereKey($vehicleId)->first();
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function string(array $arguments, string $key): string
    {
        $value = $arguments[$key] ?? '';

        return is_scalar($value) ? trim((string) $value) : '';
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function date(array $arguments, string $key): ?Carbon
    {
        $value = $this->string($arguments, $key);

        if ($value === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function limit(array $arguments): int
    {
        $limit = $arguments['limit'] ?? 20;

        return is_numeric($limit) ? max(1, min(self::MAX_ROWS, (int) $limit)) : 20;
    }

    /**
     * @param  array<string, array<string, mixed>>  $properties
     * @param  array<int, string>  $required
     * @return array{type: string, function: array{name: string, description: string, parameters: array<string, mixed>}}
     */
    private function tool(string $name, string $description, array $properties = [], array $required = []): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $name,
                'description' => $description,
                'parameters' => [
                    'type' => 'object',
                    'properties' => (object) $properties,
                    'required' => $required,
                ],
            ],
        ];
    }
}
