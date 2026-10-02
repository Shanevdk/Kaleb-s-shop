<?php

namespace App\Models;

use App\Actions\EstimateJobDuration;
use App\Enums\EstimateStatus;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Jobs\EstimateServiceRecordDuration;
use Database\Factories\ServiceRecordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

/**
 * @property string $id
 * @property string $user_id
 * @property string $vehicle_id
 * @property string|null $inspection_item_id
 * @property string $title
 * @property ServiceType $type
 * @property ServiceStatus $status
 * @property Carbon $performed_on
 * @property int|null $odometer
 * @property string $hours
 * @property string $parts_cost
 * @property string $labour_cost
 * @property string|null $description
 * @property string|null $issue_reason
 * @property EstimateStatus|null $estimate_status
 * @property string|null $estimated_hours
 * @property string|null $estimated_hours_low
 * @property string|null $estimated_hours_high
 * @property string|null $estimate_reasoning
 * @property Carbon|null $estimated_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vehicle_id', 'inspection_item_id', 'title', 'type', 'status', 'performed_on', 'odometer', 'hours', 'parts_cost', 'labour_cost', 'description', 'issue_reason'])]
class ServiceRecord extends Model
{
    /** @use HasFactory<ServiceRecordFactory> */
    use HasFactory, HasUlids;

    /**
     * A job still to be done gets its time estimated in the background as
     * soon as it is saved, and again whenever what it is changes, so nobody
     * has to ask for it.
     */
    protected static function booted(): void
    {
        static::created(function (ServiceRecord $record): void {
            if ($record->canBeEstimated()) {
                $record->queueEstimate();
            }
        });

        static::updated(function (ServiceRecord $record): void {
            if ($record->canBeEstimated() && $record->changedTheWork()) {
                $record->queueEstimate();
            }
        });
    }

    /**
     * Whether an estimate has already been asked for while saving this
     * instance, so changing the parts in the same save does not ask twice.
     */
    public bool $estimateQueued = false;

    /**
     * Have the estimate worked out again, say because the parts the job calls
     * for changed and the cost has to cover the new ones. Nothing happens if
     * one is already on its way from this save.
     */
    public function estimateAgain(): void
    {
        if ($this->canBeEstimated() && ! $this->estimateQueued) {
            $this->queueEstimate();
        }
    }

    /**
     * Mark the estimate as on its way and have it worked out after the
     * response has gone back.
     */
    private function queueEstimate(): void
    {
        $this->estimateQueued = true;

        $this->forceFill(['estimate_status' => EstimateStatus::Pending])->saveQuietly();

        EstimateServiceRecordDuration::dispatch($this, $this->estimateFingerprint())->afterCommit();
    }

    /**
     * Get a fingerprint of everything the estimate is worked out from, so an
     * answer that comes back after the job has changed again can be dropped.
     */
    public function estimateFingerprint(): string
    {
        return md5((string) json_encode([
            $this->title,
            $this->type->value,
            $this->vehicle_id,
            EstimateJobDuration::withoutEstimate($this->description),
        ]));
    }

    /**
     * Determine whether the job is one worth estimating: not yet done, in a
     * shop with the AI set up.
     */
    private function canBeEstimated(): bool
    {
        return ! $this->status->isCompleted() && filled(config('services.openrouter.key'));
    }

    /**
     * Determine whether the update that just happened changed what the job
     * is. An edit to an old "Estimated time:" line alone does not count.
     */
    private function changedTheWork(): bool
    {
        if ($this->wasChanged(['title', 'type', 'vehicle_id'])) {
            return true;
        }

        if ($this->wasChanged('description')
            && EstimateJobDuration::withoutEstimate($this->getOriginal('description')) !== EstimateJobDuration::withoutEstimate($this->description)) {
            return true;
        }

        // A finished job reopened without an estimate gets one.
        return $this->wasChanged('status') && $this->estimate_status === null;
    }

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
     * Get the checklist item the job was planned from, if it was flagged on one.
     *
     * @return BelongsTo<InspectionItem, $this>
     */
    public function inspectionItem(): BelongsTo
    {
        return $this->belongsTo(InspectionItem::class);
    }

    /**
     * Get what is wrong, for the work order: what was written up for it, or
     * failing that what was flagged on the checklist or noted on the job.
     */
    public function issueReason(): string
    {
        if (filled($this->issue_reason)) {
            return $this->issue_reason;
        }

        $item = $this->inspectionItem;

        if ($item !== null) {
            return filled($item->notes) ? "{$item->label}: {$item->notes}" : $item->label;
        }

        return EstimateJobDuration::withoutEstimate($this->description);
    }

    /**
     * Get what the parts for the job should cost, and how many of them have
     * no price yet: neither on the shelf nor estimated by the AI.
     *
     * @return array{total: float, unpriced: int}
     */
    public function partsEstimate(): array
    {
        $total = 0.0;
        $unpriced = 0;

        foreach ($this->parts as $part) {
            $priceEach = $part->priceEach();

            if ($priceEach === null) {
                $unpriced++;

                continue;
            }

            $total += $priceEach * (float) $part->quantity;
        }

        return ['total' => round($total, 2), 'unpriced' => $unpriced];
    }

    /**
     * Get the link anyone can open the job's work order with, no login
     * needed. The sheet always shows the job as it is now.
     */
    public function workOrderUrl(): string
    {
        return URL::signedRoute('work-orders.show', $this);
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
            'estimate_status' => EstimateStatus::class,
            'estimated_hours' => 'decimal:2',
            'estimated_hours_low' => 'decimal:2',
            'estimated_hours_high' => 'decimal:2',
            'estimated_at' => 'datetime',
        ];
    }
}
