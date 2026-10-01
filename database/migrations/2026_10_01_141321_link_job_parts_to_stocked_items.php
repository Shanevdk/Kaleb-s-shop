<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Parts typed onto open jobs before they were stocked never got pointed at
     * the shelf, so those jobs showed as short however much was there. Link
     * each one to the stocked part of exactly the same name and unit, the one
     * known to fit the job's vehicle first, then the one with the most stock.
     * Finished jobs are left alone so no stock moves.
     */
    public function up(): void
    {
        $parts = DB::table('service_record_parts')
            ->join('service_records', 'service_records.id', '=', 'service_record_parts.service_record_id')
            ->whereNull('service_record_parts.inventory_item_id')
            ->where('service_records.status', '!=', 'completed')
            ->select('service_record_parts.id', 'service_record_parts.name', 'service_record_parts.unit', 'service_records.vehicle_id')
            ->get();

        foreach ($parts as $part) {
            $itemId = DB::table('inventory_items')
                ->whereRaw('lower(trim(name)) = ?', [Str::lower(trim((string) preg_replace('/\s+/', ' ', $part->name)))])
                ->where('unit', $part->unit)
                ->orderByRaw(
                    'exists (select 1 from fitments where fitments.inventory_item_id = inventory_items.id and fitments.vehicle_id = ?) desc',
                    [$part->vehicle_id],
                )
                ->orderByDesc('quantity')
                ->orderBy('id')
                ->value('id');

            if ($itemId !== null) {
                DB::table('service_record_parts')->where('id', $part->id)->update(['inventory_item_id' => $itemId]);
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * The links are correct data, not schema, so they stay.
     */
    public function down(): void
    {
        //
    }
};
