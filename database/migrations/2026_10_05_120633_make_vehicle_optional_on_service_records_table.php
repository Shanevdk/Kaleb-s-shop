<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A job quick-added to the queue can wait for its vehicle to be picked.
     */
    public function up(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->ulid('vehicle_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     *
     * Any job still without a vehicle has to be given one first.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->ulid('vehicle_id')->nullable(false)->change();
        });
    }
};
