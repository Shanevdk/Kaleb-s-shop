<?php

use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Testing\TestResponse;

/**
 * Log a job through the form the mechanic actually uses.
 *
 * @param  array<string, mixed>  $overrides
 * @param  array<int, array<string, mixed>>  $parts
 */
function logJob(User $user, Vehicle $vehicle, array $overrides = [], array $parts = []): TestResponse
{
    return test()->actingAs($user)->post(route('service-records.store'), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brakes',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Completed->value,
        'performed_on' => '2026-09-01',
        'parts' => $parts,
        ...$overrides,
    ]);
}

test('completing a job takes what it used off the shelf', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 4, 'unit' => 'each'],
    ])->assertRedirect(route('service-records.index'));

    expect($item->refresh()->quantity)->toEqual(6.0);

    $part = ServiceRecordPart::firstOrFail();
    expect((float) $part->quantity_taken)->toBe(4.0)
        ->and($part->shortfall)->toBe(0.0);
});

test('a job that is only planned leaves the shelf alone', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, ['status' => ServiceStatus::Planned->value], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 4, 'unit' => 'each'],
    ]);

    expect($item->refresh()->quantity)->toEqual(10.0)
        ->and((float) ServiceRecordPart::firstOrFail()->quantity_taken)->toBe(0.0);
});

test('the stock taken is recorded against the vehicle and the job', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, ['title' => 'Rear pads'], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 2, 'unit' => 'each'],
    ]);

    $movement = StockMovement::firstOrFail();

    expect($movement->vehicle_id)->toBe($vehicle->id)
        ->and($movement->service_record_id)->toBe(ServiceRecord::firstOrFail()->id)
        ->and((float) $movement->quantity)->toBe(-2.0)
        ->and($movement->note)->toBe('Rear pads');
});

test('moving a job back off completed puts the stock back', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 4, 'unit' => 'each'],
    ]);

    $record = ServiceRecord::firstOrFail();
    $part = ServiceRecordPart::firstOrFail();

    $this->actingAs($user)->put(route('service-records.update', $record), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brakes',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::InProgress->value,
        'performed_on' => '2026-09-01',
        'parts' => [
            ['id' => $part->id, 'inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 4, 'unit' => 'each'],
        ],
    ]);

    expect($item->refresh()->quantity)->toEqual(10.0)
        ->and((float) $part->refresh()->quantity_taken)->toBe(0.0);
});

test('raising the amount used on a completed job takes only the difference', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 2, 'unit' => 'each'],
    ]);

    $record = ServiceRecord::firstOrFail();
    $part = ServiceRecordPart::firstOrFail();

    $this->actingAs($user)->put(route('service-records.update', $record), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brakes',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Completed->value,
        'performed_on' => '2026-09-01',
        'parts' => [
            ['id' => $part->id, 'inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 5, 'unit' => 'each'],
        ],
    ]);

    expect($item->refresh()->quantity)->toEqual(5.0)
        ->and((float) $part->refresh()->quantity_taken)->toBe(5.0);
});

test('dropping a part from a completed job puts what it took back', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 3, 'unit' => 'each'],
    ]);

    $record = ServiceRecord::firstOrFail();

    $this->actingAs($user)->put(route('service-records.update', $record), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brakes',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Completed->value,
        'performed_on' => '2026-09-01',
        'parts' => [],
    ]);

    expect($item->refresh()->quantity)->toEqual(10.0)
        ->and(ServiceRecordPart::count())->toBe(0);
});

test('deleting a completed job puts everything it took back', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 3, 'unit' => 'each'],
    ]);

    $this->actingAs($user)->delete(route('service-records.destroy', ServiceRecord::firstOrFail()));

    expect($item->refresh()->quantity)->toEqual(10.0);
});

test('the shelf is never taken below zero and the shortfall is flagged', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 2]);

    logJob($user, $vehicle, [], [
        ['inventory_item_id' => $item->id, 'name' => 'Brake pad set', 'quantity' => 5, 'unit' => 'each'],
    ])->assertRedirect(route('service-records.index'));

    $part = ServiceRecordPart::firstOrFail();

    expect($item->refresh()->quantity)->toEqual(0.0)
        ->and((float) $part->quantity_taken)->toBe(2.0)
        ->and($part->quantity_outstanding)->toBe(3.0);
});

test('a part the shop does not stock never moves the shelf', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    logJob($user, $vehicle, [], [
        ['name' => 'Rear wheel bearing', 'quantity' => 2, 'unit' => 'each'],
    ]);

    expect(StockMovement::count())->toBe(0)
        ->and((float) ServiceRecordPart::firstOrFail()->quantity_taken)->toBe(0.0);
});
