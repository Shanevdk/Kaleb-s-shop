<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Maintenance booked over more than one day keeps every day it is booked
     * on, and the last of them so a month's calendar can find it. Both stay
     * null for one day, which only has performed_on.
     */
    public function up(): void
    {
        Schema::table('equipment_service_records', function (Blueprint $table) {
            $table->json('scheduled_days')->nullable()->after('performed_on');
            $table->date('finishes_on')->nullable()->after('scheduled_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('equipment_service_records', function (Blueprint $table) {
            $table->dropColumn(['scheduled_days', 'finishes_on']);
        });
    }
};
