<?php

namespace App\Models;

use App\Concerns\CascadesDeletes;
use App\Enums\ChecklistTemplate;
use Database\Factories\InspectionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Carbon;
use MongoDB\Laravel\Eloquent\Model;
use MongoDB\Laravel\Relations\BelongsTo;
use MongoDB\Laravel\Relations\HasMany;

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
    use CascadesDeletes, HasFactory;

    /**
     * The relations that go when the checklist goes.
     *
     * @var array<int, string>
     */
    protected array $cascadeDeletes = ['items'];

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
