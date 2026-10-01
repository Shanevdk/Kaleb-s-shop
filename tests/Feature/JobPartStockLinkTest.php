<?php

use App\Enums\PartCategory;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;
use App\Models\Vehicle;

test('a part typed onto a job by name is linked to the stocked part of that name', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    $filter = InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 2]);

    $this->actingAs($user)->post(route('service-records.store'), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Fix: Air filter condition',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Planned->value,
        'performed_on' => '2026-10-01',
        'parts' => [['name' => '  engine  AIR filter ', 'quantity' => 1, 'unit' => 'each']],
    ])->assertSessionHasNoErrors();

    $part = ServiceRecordPart::sole();

    expect($part->inventory_item_id)->toBe($filter->id)
        ->and($part->shortfall)->toBe(0.0);
});

test('the job queue shows a job as covered once its typed part is on the shelf', function () {
    $user = User::factory()->create();
    $job = ServiceRecord::factory()->for($user)->planned()->create();
    $part = ServiceRecordPart::factory()->for($job)->create(['name' => 'Engine air filter', 'quantity' => 1]);

    expect($part->inventory_item_id)->toBeNull();

    InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 2]);

    $this->withoutVite()
        ->actingAs($user)
        ->get(route('job-queue.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('jobs.0.parts.0.shortfall', 0)
            ->where('jobs.0.parts.0.on_hand', 2)
        );
});

test('of two stocked parts with the same name, the one that fits the job vehicle is used', function () {
    $vehicle = Vehicle::factory()->create();
    $job = ServiceRecord::factory()->for($vehicle)->planned()->create();
    InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 9]);
    $fits = InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 1]);
    $fits->fitments()->create(['vehicle_id' => $vehicle->id, 'quantity_needed' => 1]);

    $part = ServiceRecordPart::factory()->for($job)->create(['name' => 'Engine air filter']);

    expect($part->inventory_item_id)->toBe($fits->id);
});

test('of two stocked parts with the same name and no fitment, the one with the most stock is used', function () {
    $job = ServiceRecord::factory()->planned()->create();
    InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 1]);
    $most = InventoryItem::factory()->create(['name' => 'Engine air filter', 'quantity' => 6]);

    $part = ServiceRecordPart::factory()->for($job)->create(['name' => 'Engine air filter']);

    expect($part->inventory_item_id)->toBe($most->id);
});

test('a part is only linked on an exact name in the same unit', function () {
    $job = ServiceRecord::factory()->planned()->create();
    InventoryItem::factory()->create(['name' => 'Cabin air filter']);
    InventoryItem::factory()->create(['name' => 'Engine oil', 'unit' => UnitOfMeasure::Litre]);

    $filter = ServiceRecordPart::factory()->for($job)->create(['name' => 'Air filter']);
    $oil = ServiceRecordPart::factory()->for($job)->create(['name' => 'Engine oil', 'unit' => UnitOfMeasure::Each]);

    expect($filter->inventory_item_id)->toBeNull()
        ->and($oil->inventory_item_id)->toBeNull();
});

test('stocking a part links the open jobs already asking for it, but not finished ones', function () {
    $user = User::factory()->create();
    $open = ServiceRecordPart::factory()
        ->for(ServiceRecord::factory()->planned())
        ->create(['name' => 'Engine air filter']);
    $finished = ServiceRecordPart::factory()
        ->for(ServiceRecord::factory()->state(['status' => ServiceStatus::Completed]))
        ->create(['name' => 'Engine air filter']);

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Engine air filter',
        'category' => PartCategory::Filters->value,
        'quantity' => 2,
    ])->assertRedirect(route('inventory.index'));

    $item = InventoryItem::sole();

    expect($open->refresh()->inventory_item_id)->toBe($item->id)
        ->and($finished->refresh()->inventory_item_id)->toBeNull();
});
