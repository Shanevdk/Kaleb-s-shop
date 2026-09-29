<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The tables whose rows used to belong to one person and now belong to
     * the shop, with `user_id` left to say who added them.
     *
     * @var array<int, string>
     */
    private array $tables = ['vehicles', 'service_records', 'inspections', 'inventory_items', 'stock_movements'];

    /**
     * Run the migrations.
     *
     * Removing someone from the team used to take everything they logged
     * with them. Now the records stay with the shop, and a barcode has to be
     * unique across the whole shop rather than per person.
     */
    public function up(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->ulid('user_id')->nullable()->change();
                $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            });
        }

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'barcode']);
            $table->unique('barcode');
        });
    }

    /**
     * Reverse the migrations.
     *
     * Rows whose author has since been removed have no one to go back to, so
     * this only works while every row still has a `user_id`.
     */
    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropUnique(['barcode']);
            $table->unique(['user_id', 'barcode']);
        });

        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->ulid('user_id')->nullable(false)->change();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }
};
