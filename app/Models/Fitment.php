<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Support\Carbon;
use MongoDB\Laravel\Eloquent\Model;
use MongoDB\Laravel\Relations\BelongsTo;

/**
 * The vehicles a stocked part is known to fit, and how much of it each one
 * takes. MongoDB has no pivot tables, so what used to be pivot columns lives
 * in its own collection.
 *
 * @property string $id
 * @property string $inventory_item_id
 * @property string $vehicle_id
 * @property string $quantity_needed
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['inventory_item_id', 'vehicle_id', 'quantity_needed', 'notes'])]
class Fitment extends Model
{
    /**
     * Get the stocked part the fitment is for.
     *
     * @return BelongsTo<InventoryItem, $this>
     */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /**
     * Get the vehicle the part fits.
     *
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity_needed' => 'decimal:2',
        ];
    }
}
