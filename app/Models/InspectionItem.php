<?php

namespace App\Models;

use App\Enums\CheckStatus;
use App\Enums\RepairPartsStatus;
use App\Enums\ServiceStatus;
use Database\Factories\InspectionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $inspection_id
 * @property string $section
 * @property string $label
 * @property CheckStatus $status
 * @property string|null $notes
 * @property RepairPartsStatus|null $parts_status
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['section', 'label', 'status', 'notes', 'parts_status', 'position'])]
class InspectionItem extends Model
{
    /** @use HasFactory<InspectionItemFactory> */
    use HasFactory, HasUlids;

    /**
     * Mirrors the column default, so a freshly created item reads as
     * unchecked without being reloaded.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'pending',
    ];

    /**
     * Get the checklist the item belongs to.
     *
     * @return BelongsTo<Inspection, $this>
     */
    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class);
    }

    /**
     * Get the repair job planned for the item when it was flagged.
     *
     * @return HasOne<ServiceRecord, $this>
     */
    public function repairJob(): HasOne
    {
        return $this->hasOne(ServiceRecord::class)->latestOfMany();
    }

    /**
     * Throw away the repair job planned for the item, as long as nobody has
     * started on it yet.
     */
    public function discardPlannedRepair(): void
    {
        ServiceRecord::query()
            ->where('inspection_item_id', $this->id)
            ->where('status', ServiceStatus::Planned)
            ->get()
            ->each->delete();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CheckStatus::class,
            'parts_status' => RepairPartsStatus::class,
            'position' => 'integer',
        ];
    }
}
