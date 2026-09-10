<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The cache store creates its own TTL index on `expires_at` the first time
     * it writes, so the collections only have to exist.
     */
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $collection) {
            $collection->index('expires_at');
        });

        Schema::create('cache_locks', function (Blueprint $collection) {
            $collection->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cache');
        Schema::dropIfExists('cache_locks');
    }
};
