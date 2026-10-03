<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Email verification starts being enforced alongside this. An unverified
     * administrator would be shut out of the Team page, the only place anyone
     * else can be let in, so administrators are vouched for here. Everyone
     * else keeps their state and is let in from the Team page.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'admin')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);
    }

    /**
     * Reverse the migrations.
     *
     * Which administrators were unverified is not kept, and unverifying every
     * one of them would shut the shop out of the Team page, so this is left
     * as it is.
     */
    public function down(): void
    {
        //
    }
};
