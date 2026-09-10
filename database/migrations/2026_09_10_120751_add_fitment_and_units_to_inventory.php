<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * MongoDB has no pivot tables, so the vehicles a part fits get their own
     * collection rather than pivot columns. The `unit` field and the widened
     * quantities need no migration on a schemaless store.
     */
    public function up(): void
    {
        Schema::create('fitments', function (Blueprint $collection) {
            $collection->unique(['inventory_item_id' => 1, 'vehicle_id' => 1]);
            $collection->index('vehicle_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fitments');
    }
};
