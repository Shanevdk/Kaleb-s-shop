<?php

namespace App\Models;

use App\Enums\ChecklistTemplate;
use App\Enums\CheckStatus;
use Database\Factories\InspectionFactory;
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
 * @property string $vehicle_id
 * @property ChecklistTemplate $template
 * @property string $title
 * @property Carbon $performed_on
 * @property int|null $odometer
 * @property string|null $notes
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vehicle_id', 'template', 'title', 'performed_on', 'odometer', 'notes', 'completed_at'])]
class Inspection extends Model
{
    /** @use HasFactory<InspectionFactory> */
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
     * Get the vehicle the checklist was run against.
     *
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Get the individual things to check.
     *
     * @return HasMany<InspectionItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InspectionItem::class)->orderBy('position');
    }

    /**
     * Count the items, and how many have been checked, still need work or
     * were fixed on the day.
     *
     * @param  Builder<Inspection>  $query
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
     * Build the checklist items from the chosen template.
     */
    public function fillFromTemplate(): void
    {
        $position = 0;
        $rows = [];

        foreach ($this->template->sections() as $section => $labels) {
            foreach ($labels as $label) {
                $rows[] = [
                    'section' => $section,
                    'label' => $label,
                    'position' => $position++,
                ];
            }
        }

        $this->items()->createMany($rows);
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
            'template' => ChecklistTemplate::class,
            'performed_on' => 'date',
            'odometer' => 'integer',
            'completed_at' => 'datetime',
        ];
    }
}
