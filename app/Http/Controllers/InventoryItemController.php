<?php

namespace App\Http\Controllers;

use App\Actions\RecordStockMovement;
use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use App\Http\Requests\AssignBarcodeRequest;
use App\Http\Requests\InventoryItemRequest;
use App\Http\Requests\StockUsageRequest;
use App\Http\Resources\InventoryItemResource;
use App\Models\Fitment;
use App\Models\InventoryItem;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class InventoryItemController extends Controller
{
    /**
     * Display everything on the shop shelves.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));
        $category = (string) $request->string('category');
        $vehicleId = (string) $request->string('vehicle');
        $lowStockOnly = $request->boolean('low_stock');

        if (! PartCategory::tryFrom($category) instanceof PartCategory) {
            $category = '';
        }

        if ($vehicleId !== '' && ! Vehicle::query()->whereKey($vehicleId)->exists()) {
            $vehicleId = '';
        }

        $items = InventoryItem::query()
            ->with('fitments.vehicle')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->whereLike('name', "%{$search}%")
                        ->orWhereLike('part_number', "%{$search}%")
                        ->orWhereLike('barcode', "%{$search}%")
                        ->orWhereLike('brand', "%{$search}%")
                        ->orWhereLike('location', "%{$search}%");
                });
            })
            ->when(PartCategory::tryFrom($category), fn ($query, PartCategory $category) => $query->where('category', $category))
            ->when($vehicleId !== '', fn ($query) => $query->whereIn(
                'id',
                Fitment::where('vehicle_id', $vehicleId)->pluck('inventory_item_id')->all(),
            ))
            ->when($lowStockOnly, fn ($query) => $query->lowStock())
            ->orderBy('name')
            ->get();

        $all = InventoryItem::query()->get();

        return Inertia::render('inventory/index', [
            'items' => InventoryItemResource::collection($items)->resolve(),
            'categories' => PartCategory::options(),
            'vehicles' => Vehicle::options(),
            'filters' => [
                'search' => $search,
                'category' => $category,
                'vehicle' => $vehicleId,
                'low_stock' => $lowStockOnly,
            ],
            'stats' => [
                'lines' => $all->count(),
                'units' => round((float) $all->sum(fn (InventoryItem $item): float => (float) $item->quantity), 2),
                'low_stock' => $all->filter(fn (InventoryItem $item): bool => $item->is_low_stock)->count(),
                'value' => round((float) $all->sum(fn (InventoryItem $item): float => $item->stock_value), 2),
            ],
        ]);
    }

    /**
     * Show the form for stocking a new part.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('inventory/create', [
            'categories' => PartCategory::options(),
            'units' => UnitOfMeasure::catalog(),
            'vehicles' => $this->fitmentOptions($request),
            'scannedBarcode' => trim((string) $request->string('barcode')),
        ]);
    }

    /**
     * Store a newly stocked part.
     */
    public function store(InventoryItemRequest $request): RedirectResponse
    {
        $inventoryItem = $request->user()->inventoryItems()->create([
            ...$request->safe()->except(['image', 'remove_image', 'fitments', 'quantity_shown']),
            'image_path' => $this->storeImage($request->file('image')),
        ]);

        $inventoryItem->syncFitments($request->fitments());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Part added to inventory.')]);

        return to_route('inventory.index');
    }

    /**
     * Show the form for editing a stocked part.
     */
    public function edit(Request $request, InventoryItem $inventoryItem): Response
    {
        Gate::authorize('update', $inventoryItem);

        return Inertia::render('inventory/edit', [
            'item' => InventoryItemResource::make($inventoryItem->load('fitments.vehicle'))->resolve(),
            'categories' => PartCategory::options(),
            'units' => UnitOfMeasure::catalog(),
            'vehicles' => $this->fitmentOptions($request),
        ]);
    }

    /**
     * Update the given stocked part.
     *
     * The amount on hand is never written straight over. A change to it is
     * applied as the difference from what the form showed and recorded as a
     * stock movement, so stock moved since the form was opened still counts.
     */
    public function update(
        InventoryItemRequest $request,
        InventoryItem $inventoryItem,
        RecordStockMovement $recordStockMovement,
    ): RedirectResponse {
        $attributes = $request->safe()->except(['image', 'remove_image', 'fitments', 'quantity', 'quantity_shown']);
        $quantityChange = $request->quantityChange($inventoryItem);
        $image = $request->file('image');

        if ($image instanceof UploadedFile) {
            $this->deleteImage($inventoryItem);
            $attributes['image_path'] = $this->storeImage($image);
        } elseif ($request->boolean('remove_image')) {
            $this->deleteImage($inventoryItem);
            $attributes['image_path'] = null;
        }

        DB::transaction(function () use ($request, $inventoryItem, $recordStockMovement, $attributes, $quantityChange): void {
            $inventoryItem->update($attributes);
            $inventoryItem->syncFitments($request->fitments());

            if ($quantityChange !== 0.0) {
                $recordStockMovement->handle($request->user(), $inventoryItem, $quantityChange, ['note' => __('Count corrected')]);
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Part updated.')]);

        return to_route('inventory.index');
    }

    /**
     * Remove the given stocked part.
     */
    public function destroy(InventoryItem $inventoryItem): RedirectResponse
    {
        Gate::authorize('delete', $inventoryItem);

        $this->deleteImage($inventoryItem);
        $inventoryItem->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Part removed.')]);

        return to_route('inventory.index');
    }

    /**
     * Take stock off the shelf or put it back on, recording what it went into.
     */
    public function adjust(
        StockUsageRequest $request,
        InventoryItem $inventoryItem,
        RecordStockMovement $recordStockMovement,
    ): RedirectResponse {
        $movement = $recordStockMovement->handle(
            $request->user(),
            $inventoryItem,
            (float) $request->validated('delta'),
            $request->safe()->only(['vehicle_id', 'service_record_id', 'note']),
        );

        if ((float) $movement->quantity < 0 && $inventoryItem->is_low_stock) {
            Inertia::flash('toast', [
                'type' => 'warning',
                'message' => __(':part is down to :quantity. Worth reordering.', [
                    'part' => $inventoryItem->name,
                    'quantity' => $inventoryItem->formattedQuantity(),
                ]),
            ]);
        }

        return back();
    }

    /**
     * Point a scanned QR code or barcode at the given part, replacing any it had.
     */
    public function assignBarcode(AssignBarcodeRequest $request, InventoryItem $inventoryItem): RedirectResponse
    {
        $inventoryItem->update(['barcode' => $request->validated('barcode')]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Code assigned to :name.', ['name' => $inventoryItem->name]),
        ]);

        return back();
    }

    /**
     * Get the vehicles a part can be marked as fitting.
     *
     * @return array<int, array{id: string, display_name: string, registration: string|null}>
     */
    private function fitmentOptions(Request $request): array
    {
        return Vehicle::query()
            ->alphabetical()
            ->get()
            ->map(fn (Vehicle $vehicle): array => [
                'id' => $vehicle->id,
                'display_name' => $vehicle->display_name,
                'registration' => $vehicle->registration,
            ])
            ->all();
    }

    /**
     * Put the uploaded part photo on the public disk.
     */
    private function storeImage(?UploadedFile $image): ?string
    {
        return $image?->store('inventory', 'public') ?: null;
    }

    /**
     * Delete the part photo currently on disk.
     */
    private function deleteImage(InventoryItem $inventoryItem): void
    {
        if ($inventoryItem->image_path !== null) {
            Storage::disk('public')->delete($inventoryItem->image_path);
        }
    }
}
