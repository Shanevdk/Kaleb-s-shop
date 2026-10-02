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
 * @property Carbon|null $parts_requested_at
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
     * Minutes the parts are waited on before working them out is given up
     * as failed. The job gives itself a minute and a half at most, so a plan
     * still pending after this died with the server it was running on and
     * is never coming.
     */
    public const PARTS_WAIT_LIMIT_MINUTES = 10;

    /**
     * Mark the item as waiting on its parts being worked out.
     */
    public function markAwaitingParts(): void
    {
        $this->forceFill([
            'parts_status' => RepairPartsStatus::Pending,
            'parts_requested_at' => now(),
        ])->save();
    }

    /**
     * Get where working out the parts has got to, counting a plan that has
     * been pending for too long as failed, so the checklist stops waiting on
     * it and it can be tried again. A late plan is still kept if it does
     * turn up.
     */
    public function currentPartsStatus(): ?RepairPartsStatus
    {
        if ($this->parts_status === RepairPartsStatus::Pending && $this->partsHaveTimedOut()) {
            return RepairPartsStatus::Failed;
        }

        return $this->parts_status;
    }

    /**
     * Determine whether the parts were asked for too long ago to still be
     * coming. One left pending from before the time was recorded counts too.
     */
    private function partsHaveTimedOut(): bool
    {
        return $this->parts_requested_at === null
            || $this->parts_requested_at->lte(now()->subMinutes(self::PARTS_WAIT_LIMIT_MINUTES));
    }

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
            'parts_requested_at' => 'datetime',
            'position' => 'integer',
        ];
    }
}
