<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The day each vehicle's monthly check and annual inspection is booked in
     * for. The period is the month (2026-09) or year (2026) the check covers,
     * so a vehicle can only be booked once per period.
     */
    public function up(): void
    {
        Schema::create('planned_inspections', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('template');
            $table->string('period', 7);
            $table->date('due_on');
            $table->timestamps();

            $table->unique(['vehicle_id', 'template', 'period']);
            $table->index('due_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('planned_inspections');
    }
};
