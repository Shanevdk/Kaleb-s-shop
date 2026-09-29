<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A checklist item flagged for attention gets a planned repair job with
     * the parts it needs, so the job remembers the item it came from and the
     * item remembers how working out those parts went.
     */
    public function up(): void
    {
        Schema::table('inspection_items', function (Blueprint $table) {
            $table->string('parts_status')->nullable()->after('notes');
        });

        Schema::table('service_records', function (Blueprint $table) {
            $table->foreignUlid('inspection_item_id')->nullable()->after('vehicle_id')->constrained()->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inspection_item_id');
        });

        Schema::table('inspection_items', function (Blueprint $table) {
            $table->dropColumn('parts_status');
        });
    }
};
