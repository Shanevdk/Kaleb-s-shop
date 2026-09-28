<?php

namespace App\Http\Resources;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Vehicle
 */
class VehicleResource extends JsonResource
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
            'make' => $this->make,
            'model' => $this->model,
            'year' => $this->year,
            'nickname' => $this->nickname,
            'registration' => $this->registration,
            'vin' => $this->vin,
            'colour' => $this->colour,
            'odometer' => $this->odometer,
            'notes' => $this->notes,
            'display_name' => $this->display_name,
            'kind' => $this->machineKind()->value,
            'kind_label' => $this->machineKind()->label(),
            'specs' => $this->specs,
            'engine' => $this->engine(),
            'engine_summary' => $this->engine_summary,
            'photos' => (object) $this->photoUrls(),
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
