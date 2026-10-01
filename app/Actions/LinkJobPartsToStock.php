<?php

namespace App\Actions;

use App\Enums\ServiceStatus;
use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
use App\Models\ServiceRecordPart;
use Illuminate\Support\Str;

class LinkJobPartsToStock
{
    /**
     * Point a job part that was typed in by name at the stocked part of the
     * same name, so the job counts what is on the shelf and takes it when
     * the job is done.
     *
     * Only an exact name in the same unit counts, so "Air filter" never
     * grabs a "Cabin air filter" and litres never meet each. The part is
     * linked but not saved; this runs as it is being saved.
     */
    public function linkPart(ServiceRecordPart $part): void
    {
        if ($part->inventory_item_id !== null || blank($part->name)) {
            return;
        }

        $item = $this->stockedPartNamed($part->name, $part->unit, $part->serviceRecord?->vehicle_id);

        if ($item !== null) {
            $part->inventory_item_id = $item->id;
        }
    }

    /**
     * Point the open jobs that were already asking for a part by name at it,
     * now that it is on the shelf.
     */
    public function linkOpenJobsTo(InventoryItem $item): void
    {
        ServiceRecordPart::query()
            ->whereNull('inventory_item_id')
            ->whereRaw('lower(trim(name)) = ?', [self::normalise($item->name)])
            ->where('unit', $item->unit->value)
            ->whereHas('serviceRecord', fn ($query) => $query->where('status', '!=', ServiceStatus::Completed->value))
            ->update(['inventory_item_id' => $item->id]);
    }

    /**
     * Find the stocked part going by a name. When more than one does, the one
     * known to fit the job's vehicle wins, then the one with the most on the
     * shelf.
     */
    private function stockedPartNamed(string $name, UnitOfMeasure $unit, ?string $vehicleId): ?InventoryItem
    {
        return InventoryItem::query()
            ->whereRaw('lower(trim(name)) = ?', [self::normalise($name)])
            ->where('unit', $unit->value)
            ->when($vehicleId !== null, fn ($query) => $query->orderByRaw(
                'exists (select 1 from fitments where fitments.inventory_item_id = inventory_items.id and fitments.vehicle_id = ?) desc',
                [$vehicleId],
            ))
            ->orderByDesc('quantity')
            ->orderBy('id')
            ->first();
    }

    /**
     * Write a part name the way it is compared: lower case, single spaced.
     */
    public static function normalise(string $name): string
    {
        return Str::lower(trim((string) preg_replace('/\s+/', ' ', $name)));
    }
}
