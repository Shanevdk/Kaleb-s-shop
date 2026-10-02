<?php

namespace App\Http\Resources;

use App\Models\InspectionItem;
use App\Models\ServiceRecordPart;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InspectionItem
 */
class InspectionItemResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'section' => $this->section,
            'label' => $this->label,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'notes' => $this->notes,
            'position' => $this->position,
            'parts_status' => $this->currentPartsStatus()?->value,
            'repair_job' => $this->whenLoaded('repairJob', fn (): ?array => $this->repairJob === null ? null : [
                'id' => $this->repairJob->id,
                'title' => $this->repairJob->title,
                'status' => $this->repairJob->status->value,
                'parts' => $this->repairJob->parts->map(fn (ServiceRecordPart $part): array => [
                    'id' => $part->id,
                    'name' => $part->name,
                    'quantity' => (float) $part->quantity,
                    'unit_abbreviation' => $part->unit->abbreviation(),
                    'in_inventory' => $part->inventoryItem !== null,
                    'on_hand' => (float) ($part->inventoryItem->quantity ?? 0),
                ])->all(),
            ]),
        ];
    }
}
