<?php

namespace App\Models;

use App\Enums\CheckStatus;
use Database\Factories\EquipmentChecklistFactory;
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

/**
 * @property string $id
 * @property string $user_id
 * @property string $equipment_id
 * @property string $title
 * @property Carbon $performed_on
 * @property string|null $notes
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['equipment_id', 'title', 'performed_on', 'notes', 'completed_at'])]
class EquipmentChecklist extends Model
{
    /** @use HasFactory<EquipmentChecklistFactory> */
    use HasFactory, HasUlids;

    /**
     * Get the owner of the checklist.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the equipment the checklist was run against.
     *
     * @return BelongsTo<Equipment, $this>
     */
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    /**
     * Get the individual things to check.
     *
     * @return HasMany<EquipmentChecklistItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(EquipmentChecklistItem::class)->orderBy('position');
    }

    /**
     * Count the items, and how many have been checked, still need work or
     * were fixed on the day.
     *
     * @param  Builder<EquipmentChecklist>  $query
     */
    #[Scope]
    protected function withCheckTallies(Builder $query): void
    {
        $needingWork = array_values(array_filter(
            CheckStatus::cases(),
            fn (CheckStatus $status): bool => $status->needsWork(),
        ));

        $query->withCount([
            'items',
            'items as checked_count' => fn (Builder $items) => $items->where('status', '!=', CheckStatus::Pending),
            'items as flagged_count' => fn (Builder $items) => $items->whereIn('status', $needingWork),
            'items as fixed_count' => fn (Builder $items) => $items->where('status', CheckStatus::Fixed),
        ]);
    }

    /**
     * Add a check to the end of the list.
     */
    public function addCheck(string $label): EquipmentChecklistItem
    {
        return $this->items()->create([
            'label' => $label,
            'position' => (int) EquipmentChecklistItem::query()->where('equipment_checklist_id', $this->id)->max('position') + 1,
        ]);
    }

    /**
     * Determine whether every item has been checked off.
     *
     * @return Attribute<bool, never>
     */
    protected function isComplete(): Attribute
    {
        return Attribute::get(fn (): bool => $this->completed_at !== null);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'performed_on' => 'date',
            'completed_at' => 'datetime',
        ];
    }
}
