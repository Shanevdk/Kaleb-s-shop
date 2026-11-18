<?php

use App\Models\ServiceRecord;
use App\Models\User;
use Illuminate\Support\Carbon;

test('mechanics cannot download the data export', function () {
    $mechanic = User::factory()->create();

    $this->actingAs($mechanic)
        ->get(route('admin.data-export'))
        ->assertForbidden();
});

test('an admin downloads every collection as one file, without sign-in secrets or work order keys', function () {
    $this->travelTo(Carbon::parse('2026-11-18 09:30:00'));
    $admin = User::factory()->admin()->withTwoFactor()->create(['remember_token' => 'remember-me-token']);
    $record = ServiceRecord::factory()->create();
    $record->resetWorkOrderLink();

    $response = $this->actingAs($admin)
        ->get(route('admin.data-export'))
        ->assertDownload('shop-data-2026-11-18-0930.json');

    $content = $response->streamedContent();
    $export = json_decode($content, true, flags: JSON_THROW_ON_ERROR);

    expect($export['exported_at'])->toBe('2026-11-18T09:30:00-05:00')
        ->and($export['collections'])->toHaveCount(18)
        ->and(array_column($export['collections']['service_records'], 'id'))->toBe([$record->id])
        ->and(array_column($export['collections']['vehicles'], 'id'))->toBe([$record->vehicle_id])
        ->and(array_column($export['collections']['users'], 'email'))->toContain($admin->email);
    expect($content)
        ->not->toContain($record->fresh()->work_order_key)
        ->not->toContain('remember-me-token')
        ->not->toContain(json_encode($admin->password));
});
