<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * An order outlives the people who placed and received it, and the part it
     * was for, so the name and details are copied onto it.
     */
    public function up(): void
    {
        Schema::create('part_orders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('inventory_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('part_number')->nullable();
            $table->string('brand')->nullable();
            $table->string('supplier')->nullable();
            $table->string('unit')->default('each');
            $table->decimal('quantity_ordered', 12, 2);
            $table->decimal('quantity_received', 12, 2)->default(0);
            $table->foreignUlid('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->index(['received_at', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('part_orders');
    }
};
