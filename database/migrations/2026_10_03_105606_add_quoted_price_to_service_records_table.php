<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A price the shop sets on a job's work order by hand, shown in place of
     * the cost worked out from the parts. Null means use the worked-out cost.
     */
    public function up(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->decimal('quoted_price', 10, 2)->nullable()->after('issue_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->dropColumn('quoted_price');
        });
    }
};
