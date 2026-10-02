<?php

namespace App\Actions;

use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RecordStockMovement
{
    /**
     * Move stock on or off the shelf and leave a trail of what it went into.
     *
     * A negative delta takes stock off the shelf. The shelf never goes below
     * zero, and the movement records what actually moved rather than what was
     * asked for.
     *
     * The amount on the shelf is read fresh and held while it changes, so two
     * movements at once, or one made from a copy of the part loaded a while
     * ago, both count rather than one writing over the other. The part handed
     * in is brought up to date with the new amount.
     *
     * The movement is put down to the given person. When nobody is known,
     * such as a job whose author has since left, it is recorded without one.
     *
     * @param  array{vehicle_id?: string|null, service_record_id?: string|null, note?: string|null}  $context
     */
    public function handle(?User $user, InventoryItem $inventoryItem, float $delta, array $context = []): StockMovement
    {
        return DB::transaction(function () use ($user, $inventoryItem, $delta, $context): StockMovement {
            $shelf = InventoryItem::query()->lockForUpdate()->findOrFail($inventoryItem->getKey());

            $onHand = (float) $shelf->quantity;
            $applied = round(max(0, $onHand + $delta) - $onHand, 2);

            $shelf->update(['quantity' => round($onHand + $applied, 2)]);

            $inventoryItem->setAttribute('quantity', $shelf->quantity);
            $inventoryItem->setAttribute('updated_at', $shelf->updated_at);
            $inventoryItem->syncOriginalAttributes(['quantity', 'updated_at']);

            $movement = new StockMovement([
                'inventory_item_id' => $inventoryItem->id,
                'vehicle_id' => $context['vehicle_id'] ?? null,
                'service_record_id' => $context['service_record_id'] ?? null,
                'quantity' => $applied,
                'note' => $context['note'] ?? null,
            ]);

            $movement->user()->associate($user);
            $movement->save();

            return $movement;
        });
    }
}
