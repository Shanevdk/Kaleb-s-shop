<?php

namespace App\Http\Resources;

use App\Enums\EstimateStatus;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A job as it goes on its work order: what is wrong, the parts it takes,
 * and what it should cost and how long it should take, both worked out
 * automatically, unless the shop has set the price by hand. Nothing from
 * the job's own notes goes on it.
 *
 * @mixin ServiceRecord
 */
class WorkOrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array{title: string, type_label: string, status_label: string, reason: string, updated_on: string|null, estimating: bool, vehicle: array{name: string, registration: string|null, vin: string|null, odometer: int|null}|null, parts: array<int, array{name: string, quantity: float, unit_abbreviation: string, price_each: float|null, line_total: float|null, priced_by: string|null}>, cost: array{total: float, unpriced: int}, quoted_price: float|null, time: array{hours: float, low: float|null, high: float|null}|null}
     */
    public function toArray(Request $request): array
    {
        $vehicle = $this->vehicle;

        return [
            'title' => $this->title,
            'type_label' => $this->type->label(),
            'status_label' => $this->status->label(),
            'reason' => $this->issueReason(),
            'updated_on' => $this->updated_at?->toDateString(),
            'estimating' => $this->isAwaitingEstimate(),
            'vehicle' => $vehicle === null ? null : [
                'name' => "{$vehicle->year} {$vehicle->make} {$vehicle->model}",
                'registration' => $vehicle->registration,
                'vin' => $vehicle->vin,
                'odometer' => $this->odometer ?? $vehicle->odometer,
            ],
            'parts' => $this->parts
                ->map(function (ServiceRecordPart $part): array {
                    $priceEach = $part->priceEach();

                    return [
                        'name' => $part->name,
                        'quantity' => (float) $part->quantity,
                        'unit_abbreviation' => $part->unit->abbreviation(),
                        'price_each' => $priceEach,
                        'line_total' => $priceEach === null ? null : round($priceEach * (float) $part->quantity, 2),
                        'priced_by' => match (true) {
                            $priceEach === null => null,
                            $part->hasShelfPrice() => 'shelf',
                            default => 'estimate',
                        },
                    ];
                })
                ->values()
                ->all(),
            'cost' => $this->partsEstimate(),
            'quoted_price' => $this->quoted_price === null ? null : (float) $this->quoted_price,
            'time' => $this->currentEstimateStatus() === EstimateStatus::Failed || $this->estimated_hours === null ? null : [
                'hours' => (float) $this->estimated_hours,
                'low' => $this->estimated_hours_low === null ? null : (float) $this->estimated_hours_low,
                'high' => $this->estimated_hours_high === null ? null : (float) $this->estimated_hours_high,
            ],
        ];
    }
}
