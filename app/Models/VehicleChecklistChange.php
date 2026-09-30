<?php

namespace App\Models;

use App\Enums\ChecklistChange;
use App\Enums\ChecklistTemplate;
use Database\Factories\VehicleChecklistChangeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A check added to or left out of one of a vehicle's checklists, applied
 * every time that checklist is started for the vehicle.
 *
 * @property string $id
 * @property string $vehicle_id
 * @property ChecklistTemplate $template
 * @property string|null $section
 * @property string $label
 * @property ChecklistChange $action
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vehicle_id', 'template', 'section', 'label', 'action'])]
class VehicleChecklistChange extends Model
{
    /** @use HasFactory<VehicleChecklistChangeFactory> */
    use HasFactory, HasUlids;

    /**
     * Get the vehicle the change is for.
     *
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Sort a checklist's changes into the checks added and the checks left
     * out, each with the section it belongs in.
     *
     * @param  Collection<int, VehicleChecklistChange>  $changes
     * @return array{added: array<int, array{section: string, label: string}>, removed: array<int, array{section: string, label: string}>}
     */
    public static function describe(Collection $changes, ChecklistTemplate $template): array
    {
        $check = function (VehicleChecklistChange $change) use ($template): array {
            $standard = collect($template->sections())
                ->search(fn (array $labels): bool => in_array($change->label, $labels, true));

            return [
                'section' => $change->section ?? (is_string($standard) ? $standard : Inspection::EXTRA_SECTION),
                'label' => $change->label,
            ];
        };

        return [
            'added' => $changes
                ->filter(fn (VehicleChecklistChange $change): bool => $change->action === ChecklistChange::Add)
                ->map($check)
                ->values()
                ->all(),
            'removed' => $changes
                ->filter(fn (VehicleChecklistChange $change): bool => $change->action === ChecklistChange::Remove)
                ->map($check)
                ->values()
                ->all(),
        ];
    }

    /**
     * Limit to the changes made to one checklist for one vehicle.
     *
     * @param  Builder<VehicleChecklistChange>  $query
     */
    #[Scope]
    protected function forChecklist(Builder $query, string $vehicleId, ChecklistTemplate $template): void
    {
        $query->where('vehicle_id', $vehicleId)->where('template', $template);
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
            'action' => ChecklistChange::class,
        ];
    }
}
