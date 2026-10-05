<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A check taken off the schedule is kept, marked skipped, so the planner
     * knows the period is dealt with and does not book it back in.
     */
    public function up(): void
    {
        Schema::table('planned_inspections', function (Blueprint $table) {
            $table->boolean('skipped')->default(false)->after('pinned');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('planned_inspections', function (Blueprint $table) {
            $table->dropColumn('skipped');
        });
    }
};
