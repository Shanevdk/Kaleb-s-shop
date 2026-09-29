<?php

namespace App\Http\Controllers;

use App\Actions\DecodeBarcode;
use App\Actions\ReceivePartOrder;
use App\Http\Requests\ReceivePartOrderRequest;
use App\Models\PartOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReceivingController extends Controller
{
    /**
     * Show the parts ticked off the shopping list as ordered that are still
     * waiting to be booked in, and what came in lately.
     */
    public function index(): Response
    {
        $pending = PartOrder::query()
            ->pending()
            ->with(['user', 'inventoryItem'])
            ->oldest()
            ->get();

        $received = PartOrder::query()
            ->whereNotNull('received_at')
            ->with(['receiver', 'inventoryItem'])
            ->latest('received_at')
            ->limit(15)
            ->get();

        return Inertia::render('receiving/index', [
            'pending' => $pending->map($this->present(...))->all(),
            'received' => $received->map($this->present(...))->all(),
        ]);
    }

    /**
     * Book a delivery in against its order.
     */
    public function store(ReceivePartOrderRequest $request, PartOrder $partOrder, ReceivePartOrder $receivePartOrder): RedirectResponse
    {
        if ($partOrder->received_at !== null) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __(':name has already been received.', ['name' => $partOrder->name]),
            ]);

            return to_route('receiving.index');
        }

        $item = $receivePartOrder->handle(
            $request->user(),
            $partOrder,
            (float) $request->validated('quantity'),
            $request->safe()->only(['description', 'barcode', 'brand']),
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Received :name. :quantity on the shelf now.', [
                'name' => $item->name,
                'quantity' => $item->formattedQuantity(),
            ]),
        ]);

        return to_route('receiving.index');
    }

    /**
     * Decode a scanned barcode into a description, and point at the open
     * order it belongs to when there is one.
     */
    public function decode(Request $request, DecodeBarcode $decoder): JsonResponse
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:255'],
        ]);

        $decoded = $decoder->handle($validated['barcode']);
        $item = $decoded['inventory_item'];

        return response()->json([
            'barcode' => $decoded['barcode'],
            'description' => $decoded['description'],
            'brand' => $decoded['brand'],
            'source' => $decoded['source'],
            'inventory_item_id' => $item?->id,
            'part_order_id' => $item === null
                ? null
                : PartOrder::query()->pending()->where('inventory_item_id', $item->id)->oldest()->value('id'),
        ]);
    }

    /**
     * Shape an order for the receiving page.
     *
     * @return array<string, mixed>
     */
    private function present(PartOrder $order): array
    {
        return [
            'id' => $order->id,
            'inventory_item_id' => $order->inventory_item_id,
            'in_inventory' => $order->inventory_item_id !== null,
            'name' => $order->name,
            'part_number' => $order->part_number,
            'brand' => $order->brand,
            'supplier' => $order->supplier,
            'barcode' => $order->inventoryItem?->barcode,
            'unit_abbreviation' => $order->unit->abbreviation(),
            'quantity_ordered' => (float) $order->quantity_ordered,
            'quantity_received' => (float) $order->quantity_received,
            'quantity_outstanding' => $order->quantity_outstanding,
            'ordered_by' => $order->user?->name,
            'ordered_at' => $order->created_at?->toIso8601String(),
            'received_by' => $order->receiver?->name,
            'received_at' => $order->received_at?->toIso8601String(),
        ];
    }
}
