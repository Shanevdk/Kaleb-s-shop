<?php

namespace App\Models;

use App\Actions\LinkJobPartsToStock;
use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use Database\Factories\InventoryItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property string $id
 * @property string $user_id
 * @property string $name
 * @property PartCategory $category
 * @property UnitOfMeasure $unit
 * @property string|null $part_number
 * @property string|null $barcode
 * @property string|null $brand
 * @property string|null $supplier
 * @property string|null $location
 * @property string $quantity
 * @property string $minimum_quantity
 * @property string $unit_cost
 * @property string|null $image_path
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'name',
    'category',
    'unit',
    'part_number',
    'barcode',
    'brand',
    'supplier',
    'location',
    'quantity',
    'minimum_quantity',
    'unit_cost',
    'image_path',
    'notes',
])]
class InventoryItem extends Model
{
    /** @use HasFactory<InventoryItemFactory> */
    use HasFactory, HasUlids;

    /**
     * Open jobs that asked for the part by name before it was stocked, or
     * before it was given that name, are pointed at it.
     */
    protected static function booted(): void
    {
        static::saved(function (InventoryItem $item): void {
            if ($item->wasRecentlyCreated || $item->wasChanged(['name', 'unit'])) {
                app(LinkJobPartsToStock::class)->linkOpenJobsTo($item);
            }
        });
    }

    /**
     * Get the owner of the stocked part.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the vehicles the part is known to fit.
     *
     * @return HasMany<Fitment, $this>
     */
    public function fitments(): HasMany
    {
        return $this->hasMany(Fitment::class);
    }

    /**
     * Get the stock taken off the shelf or put back on it.
     *
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * Line the part's fitments up with the vehicles it was just said to fit,
     * dropping the ones that were taken off.
     *
     * @param  array<string, array{quantity_needed: float, notes: string|null}>  $fitments
     */
    public function syncFitments(array $fitments): void
    {
        foreach ($fitments as $vehicleId => $attributes) {
            $this->fitments()->updateOrCreate(['vehicle_id' => (string) $vehicleId], $attributes);
        }

        $this->fitments()
            ->whereNotIn('vehicle_id', array_map(strval(...), array_keys($fitments)))
            ->delete();

        $this->unsetRelation('fitments');
    }

    /**
     * Get the public URL for the part photo.
     */
    public function imageUrl(): ?string
    {
        return $this->image_path === null
            ? null
            : Storage::disk('public')->url($this->image_path);
    }

    /**
     * Get the amount on the shelf written the way a person would say it, with
     * the unit tacked on when there is one to tack on.
     */
    public function formattedQuantity(?float $quantity = null): string
    {
        $amount = rtrim(rtrim(number_format($quantity ?? (float) $this->quantity, 2, '.', ''), '0'), '.');

        return trim($amount.' '.$this->unit->abbreviation());
    }

    /**
     * Only include parts sitting at or below their reorder point.
     *
     * @param  Builder<InventoryItem>  $query
     */
    #[Scope]
    protected function lowStock(Builder $query): void
    {
        $query->whereColumn('quantity', '<=', 'minimum_quantity');
    }

    /**
     * Determine whether stock has dropped to or below the reorder point.
     *
     * @return Attribute<bool, never>
     */
    protected function isLowStock(): Attribute
    {
        return Attribute::get(fn (): bool => (float) $this->quantity <= (float) $this->minimum_quantity);
    }

    /**
     * Get the value of the stock currently on the shelf.
     *
     * @return Attribute<float, never>
     */
    protected function stockValue(): Attribute
    {
        return Attribute::get(fn (): float => round((float) $this->quantity * (float) $this->unit_cost, 2));
    }

    /**
     * Determine whether the part is poured or cut rather than counted, so
     * usage has to be asked for rather than assumed to be one.
     *
     * @return Attribute<bool, never>
     */
    protected function isMeasured(): Attribute
    {
        return Attribute::get(fn (): bool => $this->unit->isMeasured());
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => PartCategory::class,
            'unit' => UnitOfMeasure::class,
            'quantity' => 'decimal:2',
            'minimum_quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }
}
