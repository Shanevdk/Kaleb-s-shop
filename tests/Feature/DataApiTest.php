<?php

use App\Models\ApiKey;
use App\Models\Equipment;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

const API_TOKEN = 'vdk_test-key-for-the-data-api';

test('requests without a valid key are refused with 401', function (array $headers) {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    Vehicle::factory()->create();

    $this->withHeaders($headers)
        ->getJson(route('api.v1.records.index', 'vehicles'))
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer')
        ->assertExactJson(['message' => 'Send a valid API key as "Authorization: Bearer <key>".']);
})->with([
    'no key' => [[]],
    'a key that was never made' => [['Authorization' => 'Bearer vdk_made-up']],
    'the key in the wrong header' => [['X-Api-Key' => API_TOKEN]],
]);

test('the index lists every collection with how many records it holds', function () {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    Vehicle::factory()->count(2)->create();

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.index'))
        ->assertOk()
        ->assertJsonCount(18, 'data')
        ->assertJsonFragment([
            'name' => 'vehicles',
            'count' => 2,
            'url' => url('/api/v1/vehicles'),
        ])
        ->assertJsonPath('export_url', url('/api/v1/export'));
});

test('using a key notes when it was last used', function () {
    $this->freezeSecond();
    $apiKey = ApiKey::factory()->withToken(API_TOKEN)->create();

    $this->withToken(API_TOKEN)->getJson(route('api.v1.index'))->assertOk();

    expect($apiKey->fresh()->last_used_at?->toDateTimeString())->toBe(now()->toDateTimeString());
});

test('records go out with plain dates, times with the shop offset and links to photos', function () {
    $this->travelTo(Carbon::parse('2026-11-17 09:30:00'));
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $record = ServiceRecord::factory()->create(['performed_on' => '2026-03-14', 'title' => 'Front brake pads']);
    $vehicle = $record->vehicle;
    $vehicle->update(['photos' => ['front' => 'vehicles/front.webp']]);
    $equipment = Equipment::factory()->create(['photos' => ['equipment/lift.webp']]);
    $part = InventoryItem::factory()->create(['image_path' => 'parts/pads.webp']);

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.show', ['service_records', $record->id]))
        ->assertOk()
        ->assertJsonPath('data.id', $record->id)
        ->assertJsonPath('data.title', 'Front brake pads')
        ->assertJsonPath('data.vehicle_id', $vehicle->id)
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.performed_on', '2026-03-14')
        ->assertJsonPath('data.created_at', '2026-11-17T09:30:00-05:00');

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.show', ['vehicles', $vehicle->id]))
        ->assertJsonPath('data.photo_urls', ['front' => url('/storage/vehicles/front.webp')])
        ->assertJsonMissingPath('data.photos');

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.show', ['equipment', $equipment->id]))
        ->assertJsonPath('data.photo_urls', [url('/storage/equipment/lift.webp')]);

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.show', ['inventory_items', $part->id]))
        ->assertJsonPath('data.image_url', url('/storage/parts/pads.webp'))
        ->assertJsonMissingPath('data.image_path');
});

test('sign-in secrets and work order keys are never shared', function () {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $user = User::factory()->withTwoFactor()->create(['remember_token' => 'remember-me-token']);
    $record = ServiceRecord::factory()->for($user)->create();
    $record->resetWorkOrderLink();

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.show', ['users', $user->id]))
        ->assertOk()
        ->assertJsonPath('data.email', $user->email)
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.two_factor_secret')
        ->assertJsonMissingPath('data.two_factor_recovery_codes')
        ->assertJsonMissingPath('data.remember_token')
        ->assertDontSee('remember-me-token');

    $export = $this->withToken(API_TOKEN)
        ->get(route('api.v1.export'))
        ->assertOk()
        ->streamedContent();

    expect($export)
        ->toContain($record->id)
        ->not->toContain($record->fresh()->work_order_key)
        ->not->toContain('remember-me-token')
        ->not->toContain(json_encode($user->password));
});

test('a collection is paged with a cursor, oldest first', function () {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $parts = InventoryItem::factory()->count(3)->create()->sortBy('id')->values();

    $firstPage = $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.index', ['inventory_items', 'per_page' => 2]))
        ->assertOk()
        ->assertJsonPath('data.0.id', $parts[0]->id)
        ->assertJsonPath('data.1.id', $parts[1]->id)
        ->assertJsonCount(2, 'data');

    $this->withToken(API_TOKEN)
        ->getJson($firstPage->json('links.next'))
        ->assertOk()
        ->assertJsonPath('data.0.id', $parts[2]->id)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('links.next', null);
});

test('updated_since only lists records added or changed since then, whatever the time zone it is sent in', function () {
    $this->freezeSecond();
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $recent = Vehicle::factory()->create(['updated_at' => now()->subHours(2)]);
    Vehicle::factory()->create(['updated_at' => now()->subHours(4)]);

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.index', [
            'vehicles',
            'updated_since' => now()->subHours(3)->utc()->format('Y-m-d\TH:i:s\Z'),
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $recent->id);
});

test('updated_since narrows the export too', function () {
    $this->freezeSecond();
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $recent = Vehicle::factory()->create(['updated_at' => now()->subHours(2)]);
    Vehicle::factory()->create(['updated_at' => now()->subHours(4)]);

    $response = $this->withToken(API_TOKEN)
        ->get(route('api.v1.export', ['updated_since' => now()->subHours(3)->toIso8601String()]))
        ->assertOk();

    $export = json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);

    expect(array_column($export['collections']['vehicles'], 'id'))->toBe([$recent->id]);
});

test('a bad updated_since or per_page is refused with 422', function (array $query, string $field, string $message) {
    ApiKey::factory()->withToken(API_TOKEN)->create();

    $this->withToken(API_TOKEN)
        ->getJson(route('api.v1.records.index', ['vehicles', ...$query]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'updated_since that is not a date' => [['updated_since' => 'yesterday-ish'], 'updated_since', 'The updated since field must be a valid date.'],
    'per_page over 1000' => [['per_page' => 1001], 'per_page', 'The per page field must not be greater than 1000.'],
]);

test('an unknown collection or record is 404', function (string $url) {
    ApiKey::factory()->withToken(API_TOKEN)->create();

    $this->withToken(API_TOKEN)
        ->getJson($url)
        ->assertNotFound();
})->with([
    'collection' => fn () => url('/api/v1/api_keys'),
    'record' => fn () => route('api.v1.records.show', ['vehicles', (string) Str::ulid()]),
]);

test('the export sends every collection in one response', function () {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $vehicle = Vehicle::factory()->create();

    $response = $this->withToken(API_TOKEN)
        ->get(route('api.v1.export'))
        ->assertOk();

    $export = json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);

    expect(array_keys($export['collections']))->toBe([
        'users', 'vehicles', 'inspections', 'inspection_items', 'vehicle_checklist_changes',
        'planned_inspections', 'closed_days', 'service_records', 'service_record_parts', 'inventory_items',
        'fitments', 'stock_movements', 'part_orders', 'equipment', 'equipment_checklists',
        'equipment_checklist_items', 'equipment_service_records', 'feedback',
    ])
        ->and($export['collections']['vehicles'])->toHaveCount(1)
        ->and($export['collections']['vehicles'][0]['id'])->toBe($vehicle->id)
        ->and($export['collections']['feedback'])->toBe([]);
});

test('the api cannot change anything', function () {
    ApiKey::factory()->withToken(API_TOKEN)->create();
    $vehicle = Vehicle::factory()->create();

    $this->withToken(API_TOKEN)
        ->deleteJson(route('api.v1.records.show', ['vehicles', $vehicle->id]))
        ->assertMethodNotAllowed();

    $this->assertModelExists($vehicle);
});
