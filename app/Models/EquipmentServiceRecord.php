<?php

namespace App\Models;

use App\Concerns\BooksDays;
use App\Enums\EquipmentDivision;
use App\Enums\EquipmentServiceType;
use App\Enums\ServiceStatus;
use Database\Factories\EquipmentServiceRecordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property string $equipment_id
 * @property string $title
 * @property EquipmentServiceType $type
 * @property ServiceStatus $status
 * @property Carbon $performed_on
 * @property array<int, string>|null $scheduled_days
 * @property Carbon|null $finishes_on
 * @property string $hours
 * @property string $parts_cost
 * @property string $labour_cost
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['equipment_id', 'title', 'type', 'status', 'performed_on', 'hours', 'parts_cost', 'labour_cost', 'description'])]
class EquipmentServiceRecord extends Model
{
    /** @use HasFactory<EquipmentServiceRecordFactory> */
    use BooksDays, HasFactory, HasUlids;

    /**
     * Get the owner of the service record.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the equipment the work was carried out on.
     *
     * @return BelongsTo<Equipment, $this>
     */
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    /**
     * Keep to the work done on one division's equipment.
     *
     * @param  Builder<EquipmentServiceRecord>  $query
     */
    #[Scope]
    protected function inDivision(Builder $query, EquipmentDivision $division): void
    {
        $query->whereRelation('equipment', 'division', $division);
    }

    /**
     * Get the combined parts and labour cost.
     *
     * @return Attribute<float, never>
     */
    protected function totalCost(): Attribute
    {
        return Attribute::get(fn (): float => round((float) $this->parts_cost + (float) $this->labour_cost, 2));
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => EquipmentServiceType::class,
            'status' => ServiceStatus::class,
            'performed_on' => 'date',
            'scheduled_days' => 'array',
            'finishes_on' => 'date',
            'hours' => 'decimal:2',
            'parts_cost' => 'decimal:2',
            'labour_cost' => 'decimal:2',
        ];
    }
}
