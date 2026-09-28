<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A line can name a part that is not stocked, and outlives the stocked
     * part it pointed at being removed.
     */
    public function up(): void
    {
        Schema::create('service_record_parts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('service_record_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('inventory_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('unit')->default('each');
            $table->decimal('quantity_taken', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_record_parts');
    }
};
