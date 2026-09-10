<?php

namespace App\Http\Resources;

use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockMovement
 */
class StockMovementResource extends JsonResource
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
            'inventory_item_id' => $this->inventory_item_id,
            'quantity' => (float) $this->quantity,
            'note' => $this->note,
            'logged_at' => $this->created_at?->toDateTimeString(),
            'vehicle' => $this->whenLoaded(
                'vehicle',
                fn (): ?array => $this->vehicle === null ? null : [
                    'id' => $this->vehicle->id,
                    'display_name' => $this->vehicle->display_name,
                ],
            ),
        ];
    }
}
