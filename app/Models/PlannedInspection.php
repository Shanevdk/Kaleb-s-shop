<?php

namespace App\Models;

use App\Enums\ChecklistTemplate;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\PlannedInspectionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $vehicle_id
 * @property ChecklistTemplate $template
 * @property string $period
 * @property CarbonImmutable $due_on
 * @property bool $pinned
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vehicle_id', 'template', 'period', 'due_on', 'pinned'])]
class PlannedInspection extends Model
{
    /** @use HasFactory<PlannedInspectionFactory> */
    use HasFactory, HasUlids;

    /**
     * Get the period a check of this kind falls in on the given day: the
     * month for a monthly check, the year for the annual inspection.
     */
    public static function periodFor(ChecklistTemplate $template, CarbonInterface $day): string
    {
        return $template === ChecklistTemplate::AnnualInspection
            ? $day->format('Y')
            : $day->format('Y-m');
    }

    /**
     * Get the vehicle that is booked in.
     *
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Get the first day the check can be done on and still count.
     */
    public function windowStart(): CarbonImmutable
    {
        return $this->template === ChecklistTemplate::AnnualInspection
            ? CarbonImmutable::createFromFormat('!Y', $this->period)->startOfYear()
            : CarbonImmutable::createFromFormat('!Y-m', $this->period)->startOfMonth();
    }

    /**
     * Get the last day the check can be done on and still count.
     */
    public function windowEnd(): CarbonImmutable
    {
        return $this->template === ChecklistTemplate::AnnualInspection
            ? $this->windowStart()->endOfYear()
            : $this->windowStart()->endOfMonth();
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
            'due_on' => 'immutable_date',
            'pinned' => 'boolean',
        ];
    }
}
