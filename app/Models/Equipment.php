<?php

namespace App\Models;

use App\Enums\EquipmentStatus;
use Database\Factories\EquipmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property string $name
 * @property string|null $category
 * @property string|null $serial_number
 * @property string|null $location
 * @property EquipmentStatus $status
 * @property Carbon|null $purchased_on
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'category', 'serial_number', 'location', 'status', 'purchased_on', 'notes'])]
class Equipment extends Model
{
    /** @use HasFactory<EquipmentFactory> */
    use HasFactory, HasUlids;

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
     * Get the service records logged against the equipment.
     *
     * @return HasMany<EquipmentServiceRecord, $this>
     */
    public function serviceRecords(): HasMany
    {
        return $this->hasMany(EquipmentServiceRecord::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => EquipmentStatus::class,
            'purchased_on' => 'date',
        ];
    }
}
