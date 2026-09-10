<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * MongoDB documents have no fixed shape, so the two factor fields need no
     * migration: they appear on a user document the first time they are set.
     * The migration is kept so the history still reads in order.
     */
    public function up(): void
    {
        //
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
