<?php

namespace App\Actions;

use App\Enums\PartCategory;
use App\Models\InventoryItem;
use App\Models\PartOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceivePartOrder
{
    public function __construct(
        private RecordStockMovement $recordStockMovement,
        private SyncServiceRecordStock $syncServiceRecordStock,
        private LinkJobPartsToStock $linkJobPartsToStock,
    ) {}

    /**
     * Book a delivery onto the shelf against the order it arrived for.
     *
     * A part the shop has never carried is added to the inventory, named by
     * the description the mechanic confirmed. A scanned code is stuck on the
     * part if it does not have one yet, so the next scan finds it.
     *
     * The open jobs the order was placed for are pointed at the part that
     * arrived, even when it came in under another name, and finished jobs
     * that found the shelf short take what they still owe, the oldest first.
     *
     * @param  array{description?: string|null, barcode?: string|null, brand?: string|null}  $details
     *
     * @throws ValidationException
     */
    public function handle(User $user, PartOrder $order, float $quantity, array $details = []): InventoryItem
    {
        $barcode = trim((string) ($details['barcode'] ?? '')) ?: null;
        $description = trim((string) ($details['description'] ?? '')) ?: null;

        return DB::transaction(function () use ($user, $order, $quantity, $details, $barcode, $description): InventoryItem {
            $scannedItem = $barcode === null
                ? null
                : InventoryItem::query()->where('barcode', $barcode)->first();

            $item = $order->inventoryItem ?? $scannedItem;

            if ($scannedItem !== null && $item !== null && ! $scannedItem->is($item)) {
                throw ValidationException::withMessages([
                    'barcode' => __('That code is on :scanned, not :ordered.', [
                        'scanned' => $scannedItem->name,
                        'ordered' => $item->name,
                    ]),
                ]);
            }

            if ($item === null) {
                $item = $user->inventoryItems()->create([
                    'name' => $description ?? $order->name,
                    'category' => PartCategory::Other,
                    'unit' => $order->unit,
                    'part_number' => $order->part_number,
                    'brand' => $order->brand ?? ($details['brand'] ?? null),
                    'supplier' => $order->supplier,
                    'barcode' => $barcode,
                    'quantity' => 0,
                    'minimum_quantity' => 0,
                    'unit_cost' => 0,
                ]);
            } elseif ($barcode !== null && $item->barcode === null) {
                $item->update(['barcode' => $barcode]);
            }

            if ($order->inventory_item_id === null && $item->unit === $order->unit) {
                $this->linkJobPartsToStock->linkOpenJobsAskingFor($order->name, $order->unit, $item);
            }

            $this->recordStockMovement->handle($user, $item, $quantity, ['note' => __('Received')]);

            $received = round((float) $order->quantity_received + $quantity, 2);

            $order->update([
                'inventory_item_id' => $item->id,
                'quantity_received' => $received,
                'received_by' => $user->id,
                'received_at' => $received >= (float) $order->quantity_ordered ? now() : null,
            ]);

            $this->syncServiceRecordStock->settleWhatFinishedJobsOwe($item, $user);

            return $item->refresh();
        });
    }
}
