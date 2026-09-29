<?php

namespace App\Models;

use App\Enums\UnitOfMeasure;
use Database\Factories\PartOrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string|null $user_id
 * @property string|null $inventory_item_id
 * @property string $name
 * @property string|null $part_number
 * @property string|null $brand
 * @property string|null $supplier
 * @property UnitOfMeasure $unit
 * @property string $quantity_ordered
 * @property string $quantity_received
 * @property string|null $received_by
 * @property Carbon|null $received_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'inventory_item_id',
    'name',
    'part_number',
    'brand',
    'supplier',
    'unit',
    'quantity_ordered',
    'quantity_received',
    'received_by',
    'received_at',
])]
class PartOrder extends Model
{
    /** @use HasFactory<PartOrderFactory> */
    use HasFactory, HasUlids;

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'unit' => 'each',
        'quantity_received' => 0,
    ];

    /**
     * Get the key that ties an order to its shopping list line: the stocked
     * part when there is one, otherwise the part's name.
     */
    public static function lineKey(?string $inventoryItemId, string $name): string
    {
        return $inventoryItemId !== null
            ? "item:{$inventoryItemId}"
            : 'name:'.Str::lower(trim($name));
    }

    /**
     * Get the person who ordered the part.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the person who booked the delivery in.
     *
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /**
     * Get the stocked part the order is for, if it is one the shop carries.
     *
     * @return BelongsTo<InventoryItem, $this>
     */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /**
     * Only include orders still waiting on some or all of the delivery.
     *
     * @param  Builder<PartOrder>  $query
     */
    #[Scope]
    protected function pending(Builder $query): void
    {
        $query->whereNull('received_at');
    }

    /**
     * Get the amount still to arrive.
     *
     * @return Attribute<float, never>
     */
    protected function quantityOutstanding(): Attribute
    {
        return Attribute::get(fn (): float => round(max(0, (float) $this->quantity_ordered - (float) $this->quantity_received), 2));
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit' => UnitOfMeasure::class,
            'quantity_ordered' => 'decimal:2',
            'quantity_received' => 'decimal:2',
            'received_at' => 'datetime',
        ];
    }
}
