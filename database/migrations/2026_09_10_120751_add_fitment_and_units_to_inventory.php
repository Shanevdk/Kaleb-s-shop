<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Fitments are a model of their own rather than pivot columns, so the
     * quantity and notes each vehicle needs come back with the relation.
     */
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('unit')->default('each')->after('category');
        });

        Schema::create('fitments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('vehicle_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity_needed', 10, 2)->default(1);
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['inventory_item_id', 'vehicle_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fitments');

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
