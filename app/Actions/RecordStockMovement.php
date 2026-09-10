<?php

namespace App\Actions;

use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;

class RecordStockMovement
{
    /**
     * Move stock on or off the shelf and leave a trail of what it went into.
     *
     * A negative delta takes stock off the shelf. The shelf never goes below
     * zero, and the movement records what actually moved rather than what was
     * asked for.
     *
     * The two writes are deliberately not wrapped in a transaction: MongoDB
     * cannot nest one inside the transaction a request may already be in, and
     * a movement without its stock change is recoverable from the item itself.
     *
     * @param  array{vehicle_id?: string|null, service_record_id?: string|null, note?: string|null}  $context
     */
    public function handle(User $user, InventoryItem $inventoryItem, float $delta, array $context = []): StockMovement
    {
        $onHand = (float) $inventoryItem->quantity;
        $applied = round(max(0, $onHand + $delta) - $onHand, 2);

        $inventoryItem->update(['quantity' => round($onHand + $applied, 2)]);

        return $user->stockMovements()->create([
            'inventory_item_id' => $inventoryItem->id,
            'vehicle_id' => $context['vehicle_id'] ?? null,
            'service_record_id' => $context['service_record_id'] ?? null,
            'quantity' => $applied,
            'note' => $context['note'] ?? null,
        ]);
    }
}
