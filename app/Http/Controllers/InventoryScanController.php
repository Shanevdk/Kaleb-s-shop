<?php

namespace App\Http\Controllers;

use App\Actions\RecordStockMovement;
use App\Http\Resources\InventoryItemResource;
use App\Models\InventoryItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InventoryScanController extends Controller
{
    /**
     * Show the barcode scanner.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('inventory/scan', $this->pageProps($request));
    }

    /**
     * Look a scanned barcode up and move the stock it belongs to.
     */
    public function store(Request $request, RecordStockMovement $recordStockMovement): Response
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:255'],
            'delta' => ['nullable', 'integer', 'min:-100', 'max:100'],
        ]);

        $barcode = trim($validated['barcode']);
        $delta = $validated['delta'] ?? 1;

        $item = $request->user()->inventoryItems()->where('barcode', $barcode)->first();

        if (! $item instanceof InventoryItem) {
            return Inertia::render('inventory/scan', [
                ...$this->pageProps($request),
                'result' => [
                    'status' => 'unknown',
                    'barcode' => $barcode,
                    'item' => null,
                ],
            ]);
        }

        $recordStockMovement->handle($request->user(), $item, (float) $delta, ['note' => __('Scanned')]);

        return Inertia::render('inventory/scan', [
            ...$this->pageProps($request),
            'result' => [
                'status' => 'matched',
                'barcode' => $barcode,
                'delta' => $delta,
                'item' => InventoryItemResource::make($item->refresh())->resolve(),
            ],
        ]);
    }

    /**
     * Associate a scanned barcode with a part that is already on the shelves.
     */
    public function link(Request $request, RecordStockMovement $recordStockMovement): RedirectResponse
    {
        $validated = $request->validate([
            'barcode' => [
                'required',
                'string',
                'max:255',
                Rule::unique('inventory_items', 'barcode')->where('user_id', $request->user()->id),
            ],
            'inventory_item_id' => [
                'required',
                Rule::exists('inventory_items', 'id')->where('user_id', $request->user()->id),
            ],
            'delta' => ['nullable', 'integer', 'min:-100', 'max:100'],
        ]);

        $item = $request->user()->inventoryItems()
            ->where('id', $validated['inventory_item_id'])
            ->firstOrFail();

        $item->update(['barcode' => trim($validated['barcode'])]);

        $recordStockMovement->handle(
            $request->user(),
            $item,
            (float) ($validated['delta'] ?? 1),
            ['note' => __('Scanned')],
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Barcode linked to :name.', ['name' => $item->name]),
        ]);

        return to_route('inventory.scan');
    }

    /**
     * Get the props every render of the scanner needs.
     *
     * @return array<string, mixed>
     */
    private function pageProps(Request $request): array
    {
        return [
            'items' => $request->user()->inventoryItems()
                ->orderBy('name')
                ->get()
                ->map(fn (InventoryItem $item): array => [
                    'value' => (string) $item->id,
                    'label' => $item->barcode === null
                        ? $item->name
                        : "{$item->name} (already scans as {$item->barcode})",
                ])
                ->all(),
        ];
    }
}
