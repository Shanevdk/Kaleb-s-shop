<?php

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

test('the schedule goes by the day it is in Ontario, not in UTC', function () {
    // 10pm on Tuesday the 15th in Toronto is already the 16th in UTC.
    $this->travelTo(Carbon::parse('2026-09-16 02:00:00', 'UTC'));

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index'))
        ->assertInertia(fn ($page) => $page->where('today', '2026-09-15'));
});

test('times saved while the app ran on UTC are moved to the same moment in Toronto time', function () {
    $migration = require database_path('migrations/2026_09_30_063603_move_saved_times_to_the_shop_time_zone.php');
    $user = User::factory()->create();

    // What the app wrote at 2:30pm UTC before the switch.
    DB::table('users')->where('id', $user->id)->update(['created_at' => '2026-09-10 14:30:00']);

    $migration->up();

    expect(DB::table('users')->where('id', $user->id)->value('created_at'))->toBe('2026-09-10 10:30:00')
        ->and($user->fresh()->created_at->utc()->toDateTimeString())->toBe('2026-09-10 14:30:00');

    $migration->down();

    expect(DB::table('users')->where('id', $user->id)->value('created_at'))->toBe('2026-09-10 14:30:00');
});
