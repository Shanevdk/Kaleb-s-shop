<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A check someone has put on a day by hand stays there; only the ones
     * the planner chose get moved off days the shop is closed.
     */
    public function up(): void
    {
        Schema::table('planned_inspections', function (Blueprint $table) {
            $table->boolean('pinned')->default(false)->after('due_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('planned_inspections', function (Blueprint $table) {
            $table->dropColumn('pinned');
        });
    }
};
