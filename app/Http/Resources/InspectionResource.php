<?php

namespace App\Http\Resources;

use App\Models\Inspection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Inspection
 */
class InspectionResource extends JsonResource
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
            'vehicle_id' => $this->vehicle_id,
            'template' => $this->template->value,
            'template_label' => $this->template->label(),
            'title' => $this->title,
            'performed_on' => $this->performed_on->toDateString(),
            'odometer' => $this->odometer,
            'notes' => $this->notes,
            'is_complete' => $this->is_complete,
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
                fn (): array => InspectionItemResource::collection($this->items)->resolve(),
            ),
            'vehicle' => $this->whenLoaded('vehicle', fn (): array => [
                'id' => $this->vehicle->id,
                'display_name' => $this->vehicle->display_name,
                'registration' => $this->vehicle->registration,
            ]),
        ];
    }
}
