<?php

namespace App\Http\Controllers;

use App\Http\Requests\PartOrderRequest;
use App\Models\PartOrder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class PartOrderController extends Controller
{
    /**
     * Tick a shopping list line off as ordered, or change how many were
     * ordered when it is already ticked.
     */
    public function store(PartOrderRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $inventoryItemId = $validated['inventory_item_id'] ?? null;

        $order = PartOrder::query()
            ->pending()
            ->when(
                $inventoryItemId !== null,
                fn ($query) => $query->where('inventory_item_id', $inventoryItemId),
                fn ($query) => $query->whereNull('inventory_item_id')
                    ->whereRaw('lower(name) = ?', [mb_strtolower(trim($validated['name']))]),
            )
            ->first() ?? $request->user()->partOrders()->make();

        $order->fill([
            ...$request->safe()->except('quantity'),
            'quantity_ordered' => max((float) $validated['quantity'], (float) $order->quantity_received),
        ])->save();

        return back();
    }

    /**
     * Untick a line that was marked as ordered by mistake.
     */
    public function destroy(PartOrder $partOrder): RedirectResponse
    {
        if ($partOrder->received_at !== null || (float) $partOrder->quantity_received > 0) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('Some of :name has already been received, so the order stays.', ['name' => $partOrder->name]),
            ]);

            return back();
        }

        $partOrder->delete();

        return back();
    }
}
