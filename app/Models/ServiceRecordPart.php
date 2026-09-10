<?php

namespace App\Models;

use App\Enums\UnitOfMeasure;
use Database\Factories\ServiceRecordPartFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Carbon;
use MongoDB\Laravel\Eloquent\Model;
use MongoDB\Laravel\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $service_record_id
 * @property string|null $inventory_item_id
 * @property string $name
 * @property string $quantity
 * @property UnitOfMeasure $unit
 * @property string $quantity_taken
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['inventory_item_id', 'name', 'quantity', 'unit', 'quantity_taken'])]
class ServiceRecordPart extends Model
{
    /** @use HasFactory<ServiceRecordPartFactory> */
    use HasFactory;

    /**
     * MongoDB has no column defaults, so a part line gets them here.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'quantity' => 1,
        'unit' => 'each',
        'quantity_taken' => 0,
    ];

    /**
     * Get the job the part is needed for.
     *
     * @return BelongsTo<ServiceRecord, $this>
     */
    public function serviceRecord(): BelongsTo
    {
        return $this->belongsTo(ServiceRecord::class);
    }

    /**
     * Get the stocked part this line points at, if it is one we carry.
     *
     * @return BelongsTo<InventoryItem, $this>
     */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /**
     * Get how much of the line still has to come off the shelf.
     *
     * @return Attribute<float, never>
     */
    protected function quantityOutstanding(): Attribute
    {
        return Attribute::get(fn (): float => round(max(0, (float) $this->quantity - (float) $this->quantity_taken), 2));
    }

    /**
     * Get how much of the outstanding amount cannot be covered by what is on
     * the shelf right now.
     *
     * @return Attribute<float, never>
     */
    protected function shortfall(): Attribute
    {
        return Attribute::get(function (): float {
            $onHand = $this->inventoryItem === null
                ? 0.0
                : (float) $this->inventoryItem->quantity;

            return round(max(0, $this->quantity_outstanding - $onHand), 2);
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit' => UnitOfMeasure::class,
            'quantity_taken' => 'decimal:2',
        ];
    }
}
