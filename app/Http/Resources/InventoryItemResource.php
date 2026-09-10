<?php

namespace App\Http\Resources;

use App\Models\Fitment;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryItem
 */
class InventoryItemResource extends JsonResource
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
            'name' => $this->name,
            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'unit' => $this->unit->value,
            'unit_label' => $this->unit->label(),
            'unit_abbreviation' => $this->unit->abbreviation(),
            'unit_step' => $this->unit->step(),
            'quick_amounts' => $this->unit->quickAmounts(),
            'is_measured' => $this->is_measured,
            'part_number' => $this->part_number,
            'barcode' => $this->barcode,
            'brand' => $this->brand,
            'supplier' => $this->supplier,
            'location' => $this->location,
            'quantity' => (float) $this->quantity,
            'minimum_quantity' => (float) $this->minimum_quantity,
            'unit_cost' => (float) $this->unit_cost,
            'stock_value' => $this->stock_value,
            'is_low_stock' => $this->is_low_stock,
            'image_url' => $this->imageUrl(),
            'notes' => $this->notes,
            'vehicles' => $this->whenLoaded('fitments', fn (): array => $this->fitments
                ->filter(fn (Fitment $fitment): bool => $fitment->vehicle !== null)
                ->map(fn (Fitment $fitment): array => [
                    'id' => $fitment->vehicle->id,
                    'display_name' => $fitment->vehicle->display_name,
                    'registration' => $fitment->vehicle->registration,
                    'quantity_needed' => (float) $fitment->quantity_needed,
                    'notes' => $fitment->notes,
                ])
                ->values()
                ->all()),
        ];
    }
}
