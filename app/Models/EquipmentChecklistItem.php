<?php

namespace App\Models;

use App\Enums\CheckStatus;
use Database\Factories\EquipmentChecklistItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $equipment_checklist_id
 * @property string $label
 * @property CheckStatus $status
 * @property string|null $notes
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['label', 'status', 'notes', 'position'])]
class EquipmentChecklistItem extends Model
{
    /** @use HasFactory<EquipmentChecklistItemFactory> */
    use HasFactory, HasUlids;

    /**
     * Get the checklist the item belongs to.
     *
     * @return BelongsTo<EquipmentChecklist, $this>
     */
    public function equipmentChecklist(): BelongsTo
    {
        return $this->belongsTo(EquipmentChecklist::class);
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
            'position' => 'integer',
        ];
    }
}
