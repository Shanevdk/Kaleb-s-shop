<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Unlike SQL, MongoDB treats a missing or null barcode as a value a unique
     * index has to keep unique, so the index only covers the documents that
     * actually carry one.
     */
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $collection) {
            $collection->unique(
                ['user_id' => 1, 'barcode' => 1],
                'inventory_items_user_id_barcode_unique',
                null,
                ['partialFilterExpression' => ['barcode' => ['$type' => 'string']]],
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $collection) {
            $collection->dropIndexIfExists('inventory_items_user_id_barcode_unique');
        });
    }
};
