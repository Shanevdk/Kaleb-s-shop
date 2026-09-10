<?php

namespace App\Models;

use App\Concerns\CascadesDeletes;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use Database\Factories\ServiceRecordFactory;
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
 * @property string $title
 * @property ServiceType $type
 * @property ServiceStatus $status
 * @property Carbon $performed_on
 * @property int|null $odometer
 * @property string $hours
 * @property string $parts_cost
 * @property string $labour_cost
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vehicle_id', 'title', 'type', 'status', 'performed_on', 'odometer', 'hours', 'parts_cost', 'labour_cost', 'description'])]
class ServiceRecord extends Model
{
    /** @use HasFactory<ServiceRecordFactory> */
    use CascadesDeletes, HasFactory;

    /**
     * The relations that go when the job goes.
     *
     * @var array<int, string>
     */
    protected array $cascadeDeletes = ['parts'];

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
     * Get the vehicle the work was carried out on.
     *
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Get the parts the job calls for.
     *
     * @return HasMany<ServiceRecordPart, $this>
     */
    public function parts(): HasMany
    {
        return $this->hasMany(ServiceRecordPart::class);
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
            'type' => ServiceType::class,
            'status' => ServiceStatus::class,
            'performed_on' => 'date',
            'odometer' => 'integer',
            'hours' => 'decimal:2',
            'parts_cost' => 'decimal:2',
            'labour_cost' => 'decimal:2',
        ];
    }
}
