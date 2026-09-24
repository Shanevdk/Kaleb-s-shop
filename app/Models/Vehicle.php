<?php

namespace App\Models;

use App\Concerns\CascadesDeletes;
use App\Enums\MachineKind;
use Database\Factories\VehicleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
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
 * @property MachineKind|null $kind
 * @property array<string, mixed>|null $specs
 * @property array<string, string>|null $photos
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['make', 'model', 'year', 'nickname', 'registration', 'vin', 'colour', 'odometer', 'notes', 'kind', 'specs', 'photos'])]
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
     * The photos go from disk when the vehicle goes.
     */
    protected static function booted(): void
    {
        static::deleting(function (Vehicle $vehicle): void {
            Storage::disk('public')->delete(array_values($vehicle->photos ?? []));
        });
    }

    /**
     * Get a public URL for each photo, keyed by the angle it was shot from.
     *
     * @return array<string, string>
     */
    public function photoUrls(): array
    {
        return array_map(
            fn (string $path): string => Storage::disk('public')->url($path),
            $this->photos ?? [],
        );
    }

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
     * Get the kind of machine this is, falling back to whatever the VIN
     * decoder made of it and then to a generic machine.
     */
    public function machineKind(): MachineKind
    {
        return $this->kind
            ?? MachineKind::tryFrom((string) ($this->specs['kind'] ?? ''))
            ?? MachineKind::Other;
    }

    /**
     * Get the engine specs, whether decoded or typed in.
     *
     * @return array{cylinders: int|null, displacement_l: float|null, configuration: string|null, fuel: string|null, horsepower: int|null}
     */
    public function engine(): array
    {
        $engine = (array) ($this->specs['engine'] ?? []);

        return [
            'cylinders' => isset($engine['cylinders']) ? (int) $engine['cylinders'] : null,
            'displacement_l' => isset($engine['displacement_l']) ? (float) $engine['displacement_l'] : null,
            'configuration' => $engine['configuration'] ?? null,
            'fuel' => $engine['fuel'] ?? null,
            'horsepower' => isset($engine['horsepower']) ? (int) $engine['horsepower'] : null,
        ];
    }

    /**
     * Get the engine written the way a spec sheet would: "2.8 L 4-cyl diesel".
     *
     * @return Attribute<string|null, never>
     */
    protected function engineSummary(): Attribute
    {
        return Attribute::get(function (): ?string {
            $engine = $this->engine();
            $isVee = $engine['configuration'] !== null && str_starts_with(strtolower($engine['configuration']), 'v');

            $parts = array_filter([
                $engine['displacement_l'] !== null ? rtrim(rtrim(number_format($engine['displacement_l'], 1), '0'), '.').' L' : null,
                $engine['cylinders'] !== null ? ($isVee ? 'V' : '').$engine['cylinders'].($isVee ? '' : '-cyl') : null,
                $engine['fuel'] !== null ? strtolower($engine['fuel']) : null,
                $engine['horsepower'] !== null ? $engine['horsepower'].' hp' : null,
            ]);

            return $parts === [] ? null : implode(' ', $parts);
        });
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
            'kind' => MachineKind::class,
            'specs' => 'array',
            'photos' => 'array',
        ];
    }
}
