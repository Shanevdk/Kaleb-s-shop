<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The AI's guess at what one of a part costs, for a part the shelf has no
     * price for, so a job's cost can be worked out before it is bought.
     */
    public function up(): void
    {
        Schema::table('service_record_parts', function (Blueprint $table) {
            $table->decimal('estimated_unit_cost', 10, 2)->nullable()->after('quantity_taken');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_record_parts', function (Blueprint $table) {
            $table->dropColumn('estimated_unit_cost');
        });
    }
};
