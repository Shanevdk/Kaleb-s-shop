<?php

namespace App\Http\Resources;

use App\Models\Equipment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Equipment
 */
class EquipmentResource extends JsonResource
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
            'division' => $this->division->value,
            'name' => $this->name,
            'category' => $this->category,
            'serial_number' => $this->serial_number,
            'barcode' => $this->barcode,
            'location' => $this->location,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'purchased_on' => $this->purchased_on?->toDateString(),
            'notes' => $this->notes,
            'checklists_count' => $this->whenCounted('checklists'),
            'service_records_count' => $this->whenCounted('serviceRecords'),
            'spend' => $this->when(
                array_key_exists('parts_spend', $this->getAttributes()),
                fn (): float => round(
                    (float) $this->resource->getAttribute('parts_spend') + (float) $this->resource->getAttribute('labour_spend'),
                    2,
                ),
            ),
            'last_serviced_on' => $this->when(
                array_key_exists('last_serviced_on', $this->getAttributes()),
                fn (): ?string => $this->resource->getAttribute('last_serviced_on'),
            ),
        ];
    }
}
