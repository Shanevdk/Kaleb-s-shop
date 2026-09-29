<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\OpenRouter;
use App\Enums\CheckStatus;
use App\Enums\RepairPartsStatus;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Enums\UnitOfMeasure;
use App\Models\InspectionItem;
use App\Models\InventoryItem;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;

/**
 * Work out what a flagged checklist item needs to put it right, and plan a
 * repair job for it. Anything the job needs that is not on the shelf then
 * shows up on the shopping list.
 */
class PlanRepairFromInspection
{
    /**
     * The most shelf parts described to the model in one go.
     */
    private const MAX_SHELF_PARTS = 150;

    /**
     * The most parts one repair is allowed to ask for.
     */
    private const MAX_PARTS = 10;

    public function __construct(private OpenRouter $openRouter) {}

    /**
     * Ask the model for the parts and plan the job.
     */
    public function handle(InspectionItem $item, User $user): void
    {
        $item->refresh()->load('inspection.vehicle');

        // Put right or unflagged while we were waiting on the queue.
        if ($item->status !== CheckStatus::Attention || $item->inspection->vehicle === null) {
            return;
        }

        $shelf = $this->shelfParts($item->inspection->vehicle);

        try {
            $this->openRouter->ensureConfigured();

            ['message' => $message] = $this->openRouter->complete([
                ['role' => 'system', 'content' => $this->instructions()],
                ['role' => 'user', 'content' => $this->describe($item, $shelf)],
            ], timeout: 45);

            $plan = $this->parse((string) ($message['content'] ?? ''), $shelf);
        } catch (AssistantUnavailable|JsonException $exception) {
            report($exception);
            $item->update(['parts_status' => RepairPartsStatus::Failed]);

            return;
        }

        DB::transaction(function () use ($item, $user, $plan): void {
            // The model can take a while; the item may have been put right
            // in the meantime.
            if ($item->fresh()?->status !== CheckStatus::Attention) {
                return;
            }

            $item->discardPlannedRepair();

            if ($plan['parts'] === []) {
                $item->update(['parts_status' => RepairPartsStatus::NoneNeeded]);

                return;
            }

            $inspection = $item->inspection;

            $job = $user->serviceRecords()->create([
                'vehicle_id' => $inspection->vehicle_id,
                'inspection_item_id' => $item->id,
                'title' => Str::limit("Fix: {$item->label}", 120, ''),
                'type' => $plan['type'],
                'status' => ServiceStatus::Planned,
                'performed_on' => today(),
                'odometer' => $inspection->odometer,
                'description' => trim(implode("\n", array_filter([
                    "Flagged on the {$inspection->title} checklist ({$inspection->performed_on->toDateString()}): {$item->section}, {$item->label}.",
                    filled($item->notes) ? "Note: {$item->notes}" : null,
                    'Parts worked out by the assistant; check them before ordering.',
                ]))),
            ]);

            $job->parts()->createMany($plan['parts']);

            $item->update(['parts_status' => RepairPartsStatus::Planned]);
        });
    }

    /**
     * Get the parts on the shelf, the ones known to fit the vehicle first.
     *
     * @return Collection<string, InventoryItem>
     */
    private function shelfParts(Vehicle $vehicle): Collection
    {
        return InventoryItem::query()
            ->withExists(['fitments as fits_vehicle' => fn ($query) => $query->where('vehicle_id', $vehicle->id)])
            ->orderByDesc('fits_vehicle')
            ->orderBy('name')
            ->limit(self::MAX_SHELF_PARTS)
            ->get()
            ->keyBy('id');
    }

    /**
     * Tell the model what it is for and the exact shape to answer in.
     */
    private function instructions(): string
    {
        $types = implode(', ', array_map(fn (ServiceType $type): string => $type->value, ServiceType::cases()));
        $units = implode(', ', array_map(fn (UnitOfMeasure $unit): string => $unit->value, UnitOfMeasure::cases()));

        return <<<PROMPT
        You plan the parts for repairs in a small mechanic workshop. A mechanic has flagged one item on an inspection checklist as needing attention. Work out the parts and consumables needed to put it right on this vehicle.

        Rules:
        - Only list things that have to be taken from stock or bought: parts, fluids, filters, bulbs, fasteners. Never tools or labour.
        - If it can be put right without parts (adjusting, tightening, inflating, cleaning, paperwork), return an empty parts list.
        - If a part on the shop's shelf is the right one, give its id as inventory_item_id and use its name. Otherwise set inventory_item_id to null and name the part specifically enough to order it, with its position (front, rear, left, right) and spec where you know it. Never invent part numbers.
        - Use the smallest sensible quantity. Brake pads and wiper blades come as a set or pair.

        Reply with JSON only, no other text, in exactly this shape:
        {"type": "<one of: {$types}>", "parts": [{"name": "<part>", "quantity": <number>, "unit": "<one of: {$units}>", "inventory_item_id": "<id or null>"}]}
        PROMPT;
    }

    /**
     * Describe the flagged item, the vehicle and the shelf.
     *
     * @param  Collection<string, InventoryItem>  $shelf
     */
    private function describe(InspectionItem $item, Collection $shelf): string
    {
        $inspection = $item->inspection;
        $vehicle = $inspection->vehicle;

        $shelfLines = $shelf->map(fn (InventoryItem $part): string => implode(' | ', array_filter([
            $part->id,
            $part->name,
            $part->part_number,
            $part->brand,
            $part->category->value,
            $part->getAttribute('fits_vehicle') ? 'fits this vehicle' : null,
        ])))->implode("\n");

        return implode("\n", array_filter([
            "Vehicle: {$vehicle->year} {$vehicle->make} {$vehicle->model} ({$vehicle->machineKind()->label()})",
            filled($vehicle->engine_summary) ? "Engine: {$vehicle->engine_summary}" : null,
            $inspection->odometer !== null ? "Odometer: {$inspection->odometer} km" : null,
            "Checklist: {$inspection->title}",
            "Flagged item: {$item->section} - {$item->label}",
            filled($item->notes) ? "Mechanic's note: {$item->notes}" : "Mechanic's note: none",
            '',
            'Parts on the shop\'s shelf (id | name | part number | brand | category):',
            $shelfLines !== '' ? $shelfLines : '(the shelf is empty)',
        ], fn (?string $line): bool => $line !== null));
    }

    /**
     * Pull the plan out of the model's answer, dropping anything malformed.
     *
     * @param  Collection<string, InventoryItem>  $shelf
     * @return array{type: ServiceType, parts: array<int, array{inventory_item_id: string|null, name: string, quantity: float, unit: UnitOfMeasure}>}
     *
     * @throws JsonException
     */
    private function parse(string $content, Collection $shelf): array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            throw new JsonException('The assistant did not answer with JSON.');
        }

        $answer = json_decode(substr($content, $start, $end - $start + 1), true, flags: JSON_THROW_ON_ERROR);

        if (! is_array($answer)) {
            throw new JsonException('The assistant did not answer with a JSON object.');
        }

        $parts = [];

        foreach (array_slice((array) ($answer['parts'] ?? []), 0, self::MAX_PARTS) as $part) {
            if (! is_array($part)) {
                continue;
            }

            $stocked = $shelf->get((string) ($part['inventory_item_id'] ?? ''));
            $name = Str::limit(trim((string) ($stocked->name ?? $part['name'] ?? '')), 120, '');

            if ($name === '') {
                continue;
            }

            $quantity = is_numeric($part['quantity'] ?? null) ? (float) $part['quantity'] : 1.0;

            $parts[] = [
                'inventory_item_id' => $stocked?->id,
                'name' => $name,
                'quantity' => round(min(max($quantity, 0.01), 100), 2),
                'unit' => $stocked->unit ?? UnitOfMeasure::tryFrom((string) ($part['unit'] ?? '')) ?? UnitOfMeasure::Each,
            ];
        }

        return [
            'type' => ServiceType::tryFrom((string) ($answer['type'] ?? '')) ?? ServiceType::Other,
            'parts' => $parts,
        ];
    }
}
