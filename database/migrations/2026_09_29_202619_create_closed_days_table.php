<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Days the shop is shut on top of Sundays and the Ontario statutory
     * holidays, which are worked out rather than stored.
     */
    public function up(): void
    {
        Schema::create('closed_days', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->date('date')->unique();
            $table->string('reason', 80);
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('closed_days');
    }
};
