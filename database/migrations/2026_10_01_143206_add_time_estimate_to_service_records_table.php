<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The AI's estimate of how long a job will take, worked out in the
     * background whenever the job is created or its notes change.
     */
    public function up(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->string('estimate_status')->nullable()->after('description');
            $table->decimal('estimated_hours', 6, 2)->nullable()->after('estimate_status');
            $table->decimal('estimated_hours_low', 6, 2)->nullable()->after('estimated_hours');
            $table->decimal('estimated_hours_high', 6, 2)->nullable()->after('estimated_hours_low');
            $table->text('estimate_reasoning')->nullable()->after('estimated_hours_high');
            $table->timestamp('estimated_at')->nullable()->after('estimate_reasoning');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_records', function (Blueprint $table) {
            $table->dropColumn([
                'estimate_status',
                'estimated_hours',
                'estimated_hours_low',
                'estimated_hours_high',
                'estimate_reasoning',
                'estimated_at',
            ]);
        });
    }
};
