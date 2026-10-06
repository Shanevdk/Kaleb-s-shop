<?php

namespace App\Http\Resources;

use App\Models\EquipmentServiceRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EquipmentServiceRecord
 */
class EquipmentServiceRecordResource extends JsonResource
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
            'equipment_id' => $this->equipment_id,
            'title' => $this->title,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'performed_on' => $this->performed_on->toDateString(),
            'finishes_on' => $this->finishes_on?->toDateString(),
            'days' => $this->days(),
            'hours' => (float) $this->hours,
            'parts_cost' => (float) $this->parts_cost,
            'labour_cost' => (float) $this->labour_cost,
            'total_cost' => $this->total_cost,
            'description' => $this->description,
            'equipment' => $this->whenLoaded('equipment', fn (): array => [
                'id' => $this->equipment->id,
                'name' => $this->equipment->name,
            ]),
        ];
    }
}
