<?php

namespace App\Http\Resources;

use App\Models\ServiceRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ServiceRecord
 */
class ServiceRecordResource extends JsonResource
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
            'title' => $this->title,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'performed_on' => $this->performed_on->toDateString(),
            'odometer' => $this->odometer,
            'hours' => (float) $this->hours,
            'parts_cost' => (float) $this->parts_cost,
            'labour_cost' => (float) $this->labour_cost,
            'total_cost' => $this->total_cost,
            'description' => $this->description,
            'parts' => ServiceRecordPartResource::collection($this->whenLoaded('parts')),
            'vehicle' => $this->whenLoaded('vehicle', fn (): array => [
                'id' => $this->vehicle->id,
                'display_name' => $this->vehicle->display_name,
                'registration' => $this->vehicle->registration,
            ]),
        ];
    }
}
