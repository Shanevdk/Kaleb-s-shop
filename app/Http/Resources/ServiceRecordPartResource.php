<?php

namespace App\Http\Resources;

use App\Models\ServiceRecordPart;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ServiceRecordPart
 */
class ServiceRecordPartResource extends JsonResource
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
            'service_record_id' => $this->service_record_id,
            'inventory_item_id' => $this->inventory_item_id,
            'name' => $this->name,
            'quantity' => (float) $this->quantity,
            'unit' => $this->unit->value,
            'unit_abbreviation' => $this->unit->abbreviation(),
            'quantity_taken' => (float) $this->quantity_taken,
            'quantity_outstanding' => $this->quantity_outstanding,
            'shortfall' => $this->shortfall,
            'on_hand' => $this->whenLoaded(
                'inventoryItem',
                fn (): ?float => $this->inventoryItem === null ? null : (float) $this->inventoryItem->quantity,
            ),
        ];
    }
}
