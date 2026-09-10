<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $collection) {
            $collection->index(['queue' => 1, 'reserved_at' => 1, 'available_at' => 1]);
        });

        Schema::create('job_batches');

        Schema::create('failed_jobs', function (Blueprint $collection) {
            $collection->unique('uuid');
            $collection->index(['connection' => 1, 'queue' => 1, 'failed_at' => 1]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('failed_jobs');
    }
};
