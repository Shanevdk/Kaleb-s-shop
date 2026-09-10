<?php

namespace App\Actions;

use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;

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
     * @return array<int, string> the parts the shelf could not cover in full
     */
    public function handle(ServiceRecord $serviceRecord): array
    {
        $isUsed = $serviceRecord->status->isCompleted();
        $short = [];

        foreach ($serviceRecord->parts()->with('inventoryItem')->get() as $part) {
            $wanted = $isUsed ? (float) $part->quantity : 0.0;

            if (! $this->moveTo($serviceRecord, $part, $wanted) && $isUsed) {
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
    public function release(ServiceRecord $serviceRecord, iterable $parts): void
    {
        foreach ($parts as $part) {
            $part->loadMissing('inventoryItem');

            $this->moveTo($serviceRecord, $part, 0.0);
        }
    }

    /**
     * Move a line's share of the shelf until it has taken the given amount,
     * and record what actually moved.
     *
     * Returns whether the line ended up with everything it asked for.
     */
    private function moveTo(ServiceRecord $serviceRecord, ServiceRecordPart $part, float $wanted): bool
    {
        $taken = (float) $part->quantity_taken;
        $delta = round($wanted - $taken, 2);

        if ($part->inventoryItem === null) {
            return $wanted <= 0.0;
        }

        if ($delta === 0.0) {
            return true;
        }

        // Taking stock off the shelf is a negative movement, so the amount the
        // line still wants is applied to the shelf the other way round.
        $movement = $this->recordStockMovement->handle(
            $serviceRecord->user,
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
