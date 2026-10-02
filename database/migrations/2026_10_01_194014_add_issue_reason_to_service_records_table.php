<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * What is wrong and why it needs doing, written up on the job's work
     * order.
     */
    public function up(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->text('issue_reason')->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->dropColumn('issue_reason');
        });
    }
};
