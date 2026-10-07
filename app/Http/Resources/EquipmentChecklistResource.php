<?php

namespace App\Http\Resources;

use App\Models\EquipmentChecklist;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EquipmentChecklist
 */
class EquipmentChecklistResource extends JsonResource
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
            'performed_on' => $this->performed_on->toDateString(),
            'notes' => $this->notes,
            'is_complete' => $this->is_complete,
            'is_default' => $this->whenLoaded('equipment', fn (): bool => $this->is_default),
            'checked_count' => $this->when(
                $this->resource->getAttribute('checked_count') !== null,
                fn (): int => (int) $this->resource->getAttribute('checked_count'),
            ),
            'flagged_count' => $this->when(
                $this->resource->getAttribute('flagged_count') !== null,
                fn (): int => (int) $this->resource->getAttribute('flagged_count'),
            ),
            'fixed_count' => $this->when(
                $this->resource->getAttribute('fixed_count') !== null,
                fn (): int => (int) $this->resource->getAttribute('fixed_count'),
            ),
            'items_count' => $this->whenCounted('items'),
            'items' => $this->whenLoaded(
                'items',
                fn (): array => EquipmentChecklistItemResource::collection($this->items)->resolve(),
            ),
            'equipment' => $this->whenLoaded('equipment', fn (): array => [
                'id' => $this->equipment->id,
                'name' => $this->equipment->name,
            ]),
        ];
    }
}
