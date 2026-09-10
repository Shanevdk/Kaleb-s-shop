<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ShoppingListController extends Controller
{
    /**
     * Display everything that has to be bought: parts the open jobs call for
     * that are not on the shelf, and stock that has fallen to its reorder
     * point.
     */
    public function index(Request $request): Response
    {
        $shortLines = $this->shortForOpenJobs($request);
        $reorderLines = $this->belowReorderPoint($request, array_column($shortLines, 'inventory_item_id'));

        $jobIds = collect($shortLines)->flatMap(fn (array $line): array => array_column($line['jobs'], 'id'));

        return Inertia::render('shopping-list/index', [
            'shortLines' => $shortLines,
            'reorderLines' => $reorderLines,
            'stats' => [
                'lines' => count($shortLines) + count($reorderLines),
                'not_stocked' => count(array_filter($shortLines, fn (array $line): bool => ! $line['in_inventory'])),
                'jobs' => $jobIds->unique()->count(),
                'estimated_cost' => round(
                    array_sum(array_column($shortLines, 'estimated_cost'))
                    + array_sum(array_column($reorderLines, 'estimated_cost')),
                    2,
                ),
            ],
        ]);
    }

    /**
     * Roll every part the open jobs call for into one line each, and keep the
     * ones the shelf cannot cover.
     *
     * @return array<int, array<string, mixed>>
     */
    private function shortForOpenJobs(Request $request): array
    {
        // The parts store their job id as a string, so the ids they are matched
        // against have to be strings too rather than raw object ids.
        $openJobIds = $request->user()->serviceRecords()
            ->whereIn('status', [ServiceStatus::Planned->value, ServiceStatus::InProgress->value])
            ->get(['_id'])
            ->map(fn (ServiceRecord $record): string => (string) $record->id)
            ->all();

        $parts = ServiceRecordPart::query()
            ->with(['inventoryItem', 'serviceRecord.vehicle'])
            ->whereIn('service_record_id', $openJobIds)
            ->get();

        $lines = [];

        foreach ($parts as $part) {
            $key = $part->inventory_item_id !== null
                ? "item:{$part->inventory_item_id}"
                : 'name:'.Str::lower(trim($part->name));

            $lines[$key] ??= $this->emptyLine($part);
            $lines[$key]['required'] = round($lines[$key]['required'] + $part->quantity_outstanding, 2);
            $lines[$key]['jobs'][] = [
                'id' => $part->serviceRecord->id,
                'title' => $part->serviceRecord->title,
                'vehicle' => $part->serviceRecord->vehicle?->display_name,
            ];
        }

        $lines = array_values(array_filter(
            array_map(function (array $line): array {
                $line['shortfall'] = round(max(0, $line['required'] - $line['on_hand']), 2);
                $line['estimated_cost'] = round($line['shortfall'] * $line['unit_cost'], 2);

                return $line;
            }, $lines),
            fn (array $line): bool => $line['shortfall'] > 0,
        ));

        // Parts we do not carry at all come first: they are the ones most
        // likely to hold a job up.
        usort($lines, fn (array $a, array $b): int => [$a['in_inventory'], $a['name']] <=> [$b['in_inventory'], $b['name']]);

        return $lines;
    }

    /**
     * Get the stocked parts sitting at or below their reorder point that the
     * open jobs have not already put on the list.
     *
     * @param  array<int, int|null>  $alreadyListed
     * @return array<int, array<string, mixed>>
     */
    private function belowReorderPoint(Request $request, array $alreadyListed): array
    {
        return $request->user()->inventoryItems()
            ->whereRaw(InventoryItem::lowStockExpression())
            ->where('minimum_quantity', '>', 0)
            ->whereNotIn('_id', array_filter($alreadyListed))
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryItem $item): array => [
                'inventory_item_id' => $item->id,
                'name' => $item->name,
                'part_number' => $item->part_number,
                'brand' => $item->brand,
                'supplier' => $item->supplier,
                'unit_abbreviation' => $item->unit->abbreviation(),
                'on_hand' => (float) $item->quantity,
                'minimum_quantity' => (float) $item->minimum_quantity,
                'shortfall' => round(max(0, (float) $item->minimum_quantity - (float) $item->quantity), 2) ?: 1.0,
                'unit_cost' => (float) $item->unit_cost,
                'estimated_cost' => round((round(max(0, (float) $item->minimum_quantity - (float) $item->quantity), 2) ?: 1.0) * (float) $item->unit_cost, 2),
            ])
            ->all();
    }

    /**
     * Start a shopping list line from the first job part that asked for it.
     *
     * @return array<string, mixed>
     */
    private function emptyLine(ServiceRecordPart $part): array
    {
        $item = $part->inventoryItem;

        return [
            'inventory_item_id' => $part->inventory_item_id,
            'in_inventory' => $item !== null,
            'name' => $item->name ?? $part->name,
            'part_number' => $item->part_number ?? null,
            'brand' => $item->brand ?? null,
            'supplier' => $item->supplier ?? null,
            'unit_abbreviation' => $part->unit->abbreviation(),
            'on_hand' => $item === null ? 0.0 : (float) $item->quantity,
            'unit_cost' => $item === null ? 0.0 : (float) $item->unit_cost,
            'required' => 0.0,
            'shortfall' => 0.0,
            'estimated_cost' => 0.0,
            'jobs' => [],
        ];
    }
}
