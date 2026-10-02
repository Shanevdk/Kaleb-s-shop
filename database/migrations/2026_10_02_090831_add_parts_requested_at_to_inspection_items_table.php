<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * When the parts for a flagged item were last asked for, so a plan that
     * never came back, say because the server was replaced mid-way, can be
     * given up on.
     */
    public function up(): void
    {
        Schema::table('inspection_items', function (Blueprint $table) {
            $table->timestamp('parts_requested_at')->nullable()->after('parts_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inspection_items', function (Blueprint $table) {
            $table->dropColumn('parts_requested_at');
        });
    }
};
