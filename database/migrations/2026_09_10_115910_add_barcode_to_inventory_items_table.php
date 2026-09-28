<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A unique index treats nulls as distinct, so any number of parts can go
     * without a barcode while no two parts of the same owner can share one.
     */
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('barcode')->nullable()->after('part_number');

            $table->unique(['user_id', 'barcode']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'barcode']);
            $table->dropColumn('barcode');
        });
    }
};
