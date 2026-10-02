<?php

namespace App\Actions;

use App\Enums\ServiceStatus;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;

class SyncServiceRecordStock
{
    public function __construct(private RecordStockMovement $recordStockMovement) {}

    /**
     * Bring the shelf in line with what the job says was used.
     *
     * A completed job has taken its parts; anything still planned or in
     * progress has not, so moving a job back off completed puts the stock
     * back. Only lines pointing at something we stock can move, and the shelf
     * is never taken below zero, so a line can come away part filled.
     *
     * The stock moved is put down to the person making the change, or to
     * whoever logged the job when nobody is named.
     *
     * @return array<int, string> the parts the shelf could not cover in full
     */
    public function handle(ServiceRecord $serviceRecord, ?User $actingUser = null): array
    {
        $isUsed = $serviceRecord->status->isCompleted();
        $short = [];

        foreach ($serviceRecord->parts()->with('inventoryItem')->get() as $part) {
            $wanted = $isUsed ? (float) $part->quantity : 0.0;

            if (! $this->moveTo($serviceRecord, $part, $wanted, $actingUser) && $isUsed) {
                $short[] = $part->name;
            }
        }

        return $short;
    }

    /**
     * Put everything a job took back on the shelf, for a job being deleted or
     * for lines dropped from one being edited.
     *
     * @param  iterable<int, ServiceRecordPart>  $parts
     */
    public function release(ServiceRecord $serviceRecord, iterable $parts, ?User $actingUser = null): void
    {
        foreach ($parts as $part) {
            $part->loadMissing('inventoryItem');

            $this->moveTo($serviceRecord, $part, 0.0, $actingUser);
        }
    }

    /**
     * Let the finished jobs that still owe a part take it now that more is on
     * the shelf, the oldest job first.
     *
     * A finished job that found the shelf short took what there was and kept
     * owing the rest, so stock booked in later goes to clearing that first.
     */
    public function settleWhatFinishedJobsOwe(InventoryItem $inventoryItem, ?User $actingUser = null): void
    {
        $owing = ServiceRecord::query()
            ->where('status', ServiceStatus::Completed->value)
            ->whereHas('parts', fn ($query) => $query
                ->where('inventory_item_id', $inventoryItem->id)
                ->whereColumn('quantity_taken', '<', 'quantity'))
            ->orderBy('performed_on')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        foreach ($owing as $serviceRecord) {
            $this->handle($serviceRecord, $actingUser);
        }
    }

    /**
     * Move a line's share of the shelf until it has taken the given amount,
     * and record what actually moved.
     *
     * Returns whether the line ended up with everything it asked for. A line
     * for something we do not stock has nothing to take off the shelf, so it
     * is never counted as short.
     */
    private function moveTo(ServiceRecord $serviceRecord, ServiceRecordPart $part, float $wanted, ?User $actingUser): bool
    {
        $taken = (float) $part->quantity_taken;
        $delta = round($wanted - $taken, 2);

        if ($part->inventoryItem === null) {
            return true;
        }

        if ($delta === 0.0) {
            return true;
        }

        // Taking stock off the shelf is a negative movement, so the amount the
        // line still wants is applied to the shelf the other way round.
        $movement = $this->recordStockMovement->handle(
            $actingUser ?? $serviceRecord->user,
            $part->inventoryItem,
            -$delta,
            [
                'vehicle_id' => $serviceRecord->vehicle_id,
                'service_record_id' => $serviceRecord->id,
                'note' => $serviceRecord->title,
            ],
        );

        $part->update(['quantity_taken' => round($taken - (float) $movement->quantity, 2)]);

        return (float) $part->quantity_taken === $wanted;
    }
}
