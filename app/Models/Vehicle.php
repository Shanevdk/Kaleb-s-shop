<?php

namespace App\Models;

use App\Concerns\CascadesDeletes;
use Database\Factories\VehicleFactory;
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
 * @property string $make
 * @property string $model
 * @property int $year
 * @property string|null $nickname
 * @property string|null $registration
 * @property string|null $vin
 * @property string|null $colour
 * @property int|null $odometer
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['make', 'model', 'year', 'nickname', 'registration', 'vin', 'colour', 'odometer', 'notes'])]
class Vehicle extends Model
{
    /** @use HasFactory<VehicleFactory> */
    use CascadesDeletes, HasFactory;

    /**
     * The relations that go when the vehicle goes.
     *
     * @var array<int, string>
     */
    protected array $cascadeDeletes = ['serviceRecords', 'inspections', 'fitments'];

    /**
     * Get the owner of the vehicle.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the service records logged against the vehicle.
     *
     * @return HasMany<ServiceRecord, $this>
     */
    public function serviceRecords(): HasMany
    {
        return $this->hasMany(ServiceRecord::class);
    }

    /**
     * Get the checklists run against the vehicle.
     *
     * @return HasMany<Inspection, $this>
     */
    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    /**
     * Get the stocked parts that are known to fit the vehicle.
     *
     * @return HasMany<Fitment, $this>
     */
    public function fitments(): HasMany
    {
        return $this->hasMany(Fitment::class);
    }

    /**
     * Get the display name for the vehicle.
     *
     * @return Attribute<string, never>
     */
    protected function displayName(): Attribute
    {
        return Attribute::get(fn (): string => $this->nickname ?: "{$this->year} {$this->make} {$this->model}");
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'odometer' => 'integer',
        ];
    }
}
