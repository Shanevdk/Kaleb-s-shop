<?php

namespace App\Models;

use App\Enums\EquipmentDivision;
use App\Enums\EquipmentStatus;
use Database\Factories\EquipmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property string $id
 * @property string $user_id
 * @property EquipmentDivision $division
 * @property string $name
 * @property string|null $category
 * @property string|null $serial_number
 * @property string|null $barcode
 * @property string|null $location
 * @property EquipmentStatus $status
 * @property Carbon|null $purchased_on
 * @property string|null $notes
 * @property array<int, string>|null $photos
 * @property string|null $default_checklist_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['division', 'name', 'category', 'serial_number', 'barcode', 'location', 'status', 'purchased_on', 'notes', 'photos'])]
class Equipment extends Model
{
    /** @use HasFactory<EquipmentFactory> */
    use HasFactory, HasUlids;

    /**
     * How many photos a piece of equipment can keep.
     */
    public const MAX_PHOTOS = 20;

    /**
     * The photos go from disk when the equipment goes.
     */
    protected static function booted(): void
    {
        static::deleting(function (Equipment $equipment): void {
            Storage::disk('public')->delete($equipment->photos ?? []);
        });
    }

    /**
     * Get each photo, oldest first, with the file name it is removed by and
     * its public URL.
     *
     * @return array<int, array{id: string, url: string}>
     */
    public function photoList(): array
    {
        return array_map(
            fn (string $path): array => [
                'id' => basename($path),
                'url' => Storage::disk('public')->url($path),
            ],
            $this->photos ?? [],
        );
    }

    /**
     * Get the owner of the equipment record.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the checklists run against the equipment.
     *
     * @return HasMany<EquipmentChecklist, $this>
     */
    public function checklists(): HasMany
    {
        return $this->hasMany(EquipmentChecklist::class);
    }

    /**
     * Get the checklist the next one is started from. Each new checklist
     * takes over as the default, so checks added to or taken off it carry
     * forward.
     *
     * @return BelongsTo<EquipmentChecklist, $this>
     */
    public function defaultChecklist(): BelongsTo
    {
        return $this->belongsTo(EquipmentChecklist::class, 'default_checklist_id');
    }

    /**
     * Get the service records logged against the equipment.
     *
     * @return HasMany<EquipmentServiceRecord, $this>
     */
    public function serviceRecords(): HasMany
    {
        return $this->hasMany(EquipmentServiceRecord::class);
    }

    /**
     * Keep to the equipment belonging to one division.
     *
     * @param  Builder<Equipment>  $query
     */
    #[Scope]
    protected function inDivision(Builder $query, EquipmentDivision $division): void
    {
        $query->where('division', $division);
    }

    /**
     * Find the equipment a scanned code belongs to: the QR code or barcode
     * assigned to it, or else the serial number printed on its plate.
     */
    public static function findByCode(string $code): ?self
    {
        return static::query()->where('barcode', $code)->first()
            ?? static::query()->where('serial_number', $code)->first();
    }

    /**
     * Get every piece of the division's equipment as a select option,
     * ordered by name.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(EquipmentDivision $division): array
    {
        return static::query()
            ->inDivision($division)
            ->orderBy('name')
            ->get()
            ->map(fn (self $equipment): array => [
                'value' => $equipment->id,
                'label' => $equipment->name,
            ])
            ->all();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'division' => EquipmentDivision::class,
            'status' => EquipmentStatus::class,
            'purchased_on' => 'date',
            'photos' => 'array',
        ];
    }

    /**
     * Get the default attribute values.
     *
     * Mirrors the column default, so equipment created without a division
     * is VDK-Equipment's without being reloaded.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'division' => 'main',
    ];
}
