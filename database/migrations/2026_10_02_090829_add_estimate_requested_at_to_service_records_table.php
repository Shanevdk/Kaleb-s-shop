<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * When the job's estimate was last asked for, so one that never came
     * back, say because the server was replaced mid-way, can be given up on.
     */
    public function up(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->timestamp('estimate_requested_at')->nullable()->after('estimate_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->dropColumn('estimate_requested_at');
        });
    }
};
