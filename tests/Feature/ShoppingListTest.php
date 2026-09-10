<?php

use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;
use App\Models\Vehicle;

test('guests cannot see the shopping list', function () {
    $this->get(route('shopping-list.index'))->assertRedirect(route('login'));
});

test('parts an open job needs that are not in inventory are listed', function () {
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->for($user)->create(['status' => ServiceStatus::Planned]);

    ServiceRecordPart::factory()->for($record)->create([
        'name' => 'Rear wheel bearing',
        'quantity' => 2,
    ]);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('shopping-list/index')
            ->has('shortLines', 1)
            ->where('shortLines.0.name', 'Rear wheel bearing')
            ->where('shortLines.0.in_inventory', false)
            ->where('shortLines.0.shortfall', 2)
            ->where('stats.not_stocked', 1)
        );
});

test('a job part covered by stock stays off the list', function () {
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->for($user)->create(['status' => ServiceStatus::Planned]);
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10, 'minimum_quantity' => 0]);

    ServiceRecordPart::factory()->for($record)->create([
        'inventory_item_id' => $item->id,
        'name' => $item->name,
        'quantity' => 2,
    ]);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('shortLines', 0));
});

test('the same part across two open jobs is rolled into one line', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 1, 'minimum_quantity' => 0, 'unit_cost' => 20]);

    foreach (['Front brakes', 'Rear brakes'] as $title) {
        $record = ServiceRecord::factory()->for($user)->create([
            'title' => $title,
            'status' => ServiceStatus::Planned,
        ]);

        ServiceRecordPart::factory()->for($record)->create([
            'inventory_item_id' => $item->id,
            'name' => $item->name,
            'quantity' => 2,
        ]);
    }

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('shortLines', 1)
            ->where('shortLines.0.required', 4)
            ->where('shortLines.0.shortfall', 3)
            ->where('shortLines.0.estimated_cost', 60)
            ->has('shortLines.0.jobs', 2)
            ->where('stats.jobs', 2)
        );
});

test('parts for a finished job are not on the list', function () {
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->for($user)->create(['status' => ServiceStatus::Completed]);

    ServiceRecordPart::factory()->for($record)->create(['name' => 'Rear wheel bearing']);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('shortLines', 0));
});

test('stock at its reorder point is listed separately', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create([
        'name' => 'Air filter',
        'quantity' => 1,
        'minimum_quantity' => 5,
        'unit_cost' => 10,
    ]);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('reorderLines', 1)
            ->where('reorderLines.0.name', 'Air filter')
            ->where('reorderLines.0.shortfall', 4)
            ->where('reorderLines.0.estimated_cost', 40)
        );
});

test('the shopping list only covers the current user', function () {
    $record = ServiceRecord::factory()->create(['status' => ServiceStatus::Planned]);

    ServiceRecordPart::factory()->for($record)->create(['name' => 'Someone elses bearing']);

    $this->actingAs(User::factory()->create())
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('shortLines', 0)->has('reorderLines', 0));
});

test('a job can be logged with the parts it needs', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create();

    $this->actingAs($user)->post(route('service-records.store'), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brakes',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Planned->value,
        'performed_on' => '2026-09-10',
        'parts' => [
            ['inventory_item_id' => $item->id, 'name' => $item->name, 'quantity' => 2, 'unit' => 'each'],
            ['name' => 'Rear wheel bearing', 'quantity' => 1, 'unit' => 'each'],
        ],
    ])->assertRedirect(route('service-records.index'));

    expect(ServiceRecord::firstWhere('title', 'Front brakes')->parts)->toHaveCount(2);
});

test('a part still owed by an open job stays on the list once part of it is on the shelf', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 1, 'minimum_quantity' => 0]);
    $record = ServiceRecord::factory()->for($user)->create(['status' => ServiceStatus::Planned]);

    ServiceRecordPart::factory()->for($record)->create([
        'inventory_item_id' => $item->id,
        'name' => $item->name,
        'quantity' => 4,
        'quantity_taken' => 1,
    ]);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('shortLines', 1)
            ->where('shortLines.0.required', 3)
            ->where('shortLines.0.shortfall', 2)
        );
});
