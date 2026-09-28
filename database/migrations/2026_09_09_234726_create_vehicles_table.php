<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('make');
            $table->string('model');
            $table->unsignedSmallInteger('year');
            $table->string('nickname')->nullable();
            $table->string('registration')->nullable();
            $table->string('vin')->nullable();
            $table->string('colour')->nullable();
            $table->unsignedInteger('odometer')->nullable();
            $table->text('notes')->nullable();
            $table->string('kind')->nullable();
            $table->json('specs')->nullable();
            $table->json('photos')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'make', 'model']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
