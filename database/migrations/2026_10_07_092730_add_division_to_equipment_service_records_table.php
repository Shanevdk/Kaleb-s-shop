<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A job quick-added to a division's queue can wait for its machine to be
     * picked, so the job keeps the division it belongs to itself. Work
     * already logged takes its equipment's division.
     */
    public function up(): void
    {
        Schema::table('equipment_service_records', function (Blueprint $table) {
            $table->string('division')->default('main')->after('user_id');
            $table->ulid('equipment_id')->nullable()->change();

            $table->index(['division', 'performed_on']);
        });

        DB::table('equipment_service_records')->update([
            'division' => DB::raw('(select equipment.division from equipment where equipment.id = equipment_service_records.equipment_id)'),
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * Any job still without a machine has to be given one first.
     */
    public function down(): void
    {
        Schema::table('equipment_service_records', function (Blueprint $table) {
            $table->dropIndex(['division', 'performed_on']);
            $table->dropColumn('division');
            $table->ulid('equipment_id')->nullable(false)->change();
        });
    }
};
