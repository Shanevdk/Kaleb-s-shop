<?php

namespace App\Models;

use App\Enums\ChecklistChange;
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
     * Where a check goes when it is added without a section of its own.
     */
    public const EXTRA_SECTION = 'Extra checks';

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
     * Build the checklist items from the chosen template, as changed for this
     * vehicle: the checks added to its copy of the checklist go in and the
     * ones left out stay out.
     */
    public function fillFromTemplate(): void
    {
        $position = 0;
        $rows = [];

        foreach ($this->sectionsForVehicle() as $section => $labels) {
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
     * Get the template's checks by section, with this vehicle's added checks
     * at the end of their sections and its left-out checks gone.
     *
     * @return array<string, array<int, string>>
     */
    public function sectionsForVehicle(): array
    {
        $changes = VehicleChecklistChange::query()
            ->forChecklist($this->vehicle_id, $this->template)
            ->oldest()
            ->oldest('id')
            ->get();

        $removed = $changes
            ->filter(fn (VehicleChecklistChange $change): bool => $change->action === ChecklistChange::Remove)
            ->pluck('label')
            ->all();

        $sections = [];

        foreach ($this->template->sections() as $section => $labels) {
            $kept = array_values(array_diff($labels, $removed));

            if ($kept !== []) {
                $sections[$section] = $kept;
            }
        }

        foreach ($changes as $change) {
            $section = $change->section ?? self::EXTRA_SECTION;

            if ($change->action === ChecklistChange::Add && ! in_array($change->label, $sections[$section] ?? [], true)) {
                $sections[$section][] = $change->label;
            }
        }

        return $sections;
    }

    /**
     * Get what has been added to and left out of this vehicle's copy of the
     * checklist, each check with the section it belongs in.
     *
     * @return array{added: array<int, array{section: string, label: string}>, removed: array<int, array{section: string, label: string}>}
     */
    public function vehicleChanges(): array
    {
        return VehicleChecklistChange::describe(
            VehicleChecklistChange::query()
                ->forChecklist($this->vehicle_id, $this->template)
                ->oldest()
                ->oldest('id')
                ->get(),
            $this->template,
        );
    }

    /**
     * Add a check to the end of a section, and unless it is for this
     * checklist only, to this vehicle's copy of the checklist from now on.
     */
    public function addCheck(string $section, string $label, bool $remember): InspectionItem
    {
        $item = $this->items()->create([
            'section' => $section,
            'label' => $label,
            'position' => (int) InspectionItem::query()->where('inspection_id', $this->id)->max('position') + 1,
        ]);

        if ($remember) {
            // Putting a standard check back where it belongs just forgets
            // that it was left out; anything else is remembered as added.
            VehicleChecklistChange::query()
                ->forChecklist($this->vehicle_id, $this->template)
                ->where('label', $label)
                ->where('action', ChecklistChange::Remove)
                ->delete();

            if (! in_array($label, $this->template->sections()[$section] ?? [], true)) {
                VehicleChecklistChange::query()->firstOrCreate(
                    [
                        'vehicle_id' => $this->vehicle_id,
                        'template' => $this->template,
                        'label' => $label,
                        'action' => ChecklistChange::Add,
                    ],
                    ['section' => $section],
                );
            }
        }

        return $item;
    }

    /**
     * Take a check off the checklist, along with a repair planned for it that
     * nobody has started, and unless it is for this checklist only, off this
     * vehicle's copy of the checklist from now on.
     */
    public function removeCheck(InspectionItem $item, bool $remember): void
    {
        $item->discardPlannedRepair();
        $item->delete();

        if (! $remember) {
            return;
        }

        // Taking off a check added for this vehicle just forgets adding it;
        // a standard check is remembered as left out.
        $forgotten = VehicleChecklistChange::query()
            ->forChecklist($this->vehicle_id, $this->template)
            ->where('label', $item->label)
            ->where('action', ChecklistChange::Add)
            ->delete();

        $isStandard = in_array($item->label, array_merge(...array_values($this->template->sections())), true);

        if ($forgotten === 0 && $isStandard) {
            VehicleChecklistChange::query()->firstOrCreate(
                [
                    'vehicle_id' => $this->vehicle_id,
                    'template' => $this->template,
                    'label' => $item->label,
                    'action' => ChecklistChange::Remove,
                ],
                ['section' => $item->section],
            );
        }
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
