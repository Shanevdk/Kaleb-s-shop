<?php

use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use App\Models\Fitment;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;

/**
 * Say that a part fits a vehicle, and how much of it that vehicle takes.
 */
function fit(InventoryItem $item, Vehicle $vehicle, float $quantityNeeded = 1): Fitment
{
    return Fitment::create([
        'inventory_item_id' => $item->id,
        'vehicle_id' => $vehicle->id,
        'quantity_needed' => $quantityNeeded,
    ]);
}

test('a part can be marked as fitting vehicles when it is stocked', function () {
    $user = User::factory()->create();
    $hilux = Vehicle::factory()->for($user)->create();
    $golf = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Oil filter',
        'category' => PartCategory::Filters->value,
        'unit' => UnitOfMeasure::Each->value,
        'quantity' => 6,
        'minimum_quantity' => 2,
        'unit_cost' => 14.5,
        'fitments' => [
            ['vehicle_id' => $hilux->id, 'quantity_needed' => 1],
            ['vehicle_id' => $golf->id, 'quantity_needed' => 2],
        ],
    ])->assertRedirect(route('inventory.index'));

    $item = InventoryItem::firstWhere('name', 'Oil filter');

    expect($item->fitments)->toHaveCount(2)
        ->and((float) $item->fitments->firstWhere('vehicle_id', $golf->id)->quantity_needed)->toBe(2.0);
});

test('a part cannot be marked as fitting someone elses vehicle', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Oil filter',
        'category' => PartCategory::Filters->value,
        'unit' => UnitOfMeasure::Each->value,
        'quantity' => 6,
        'minimum_quantity' => 2,
        'unit_cost' => 14.5,
        'fitments' => [['vehicle_id' => Vehicle::factory()->create()->id, 'quantity_needed' => 1]],
    ])->assertSessionHasErrors('fitments.0.vehicle_id');
});

test('editing a part replaces the vehicles it fits', function () {
    $user = User::factory()->create();
    $old = Vehicle::factory()->for($user)->create();
    $new = Vehicle::factory()->for($user)->create();

    $item = InventoryItem::factory()->for($user)->create();
    fit($item, $old);

    $this->actingAs($user)->put(route('inventory.update', $item), [
        'name' => $item->name,
        'category' => $item->category->value,
        'unit' => $item->unit->value,
        'quantity' => $item->quantity,
        'minimum_quantity' => $item->minimum_quantity,
        'unit_cost' => $item->unit_cost,
        'fitments' => [['vehicle_id' => $new->id, 'quantity_needed' => 3]],
    ])->assertRedirect(route('inventory.index'));

    expect($item->refresh()->fitments->pluck('vehicle_id')->all())->toBe([$new->id]);
});

test('the inventory can be narrowed to the parts that fit a vehicle', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $fits = InventoryItem::factory()->for($user)->create(['name' => 'Hilux oil filter']);
    fit($fits, $vehicle);
    InventoryItem::factory()->for($user)->create(['name' => 'Random bracket']);

    $this->actingAs($user)
        ->get(route('inventory.index', ['vehicle' => $vehicle->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('items', 1)
            ->where('items.0.id', $fits->id)
            ->where('items.0.vehicles.0.quantity_needed', 1)
        );
});

test('a vehicle page lists the parts it takes and what is short', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $short = InventoryItem::factory()->for($user)->create(['name' => 'Brake pads', 'quantity' => 0]);
    fit($short, $vehicle);

    $covered = InventoryItem::factory()->for($user)->create(['name' => 'Air filter', 'quantity' => 4]);
    fit($covered, $vehicle);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('parts', 2)
            ->where('parts.0.name', 'Air filter')
            ->where('parts.0.shortfall', 0)
            ->where('parts.1.name', 'Brake pads')
            ->where('parts.1.shortfall', 1)
        );
});

test('a part of a fluid can be used and the amount is logged', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $oil = InventoryItem::factory()->for($user)->fluid()->create(['quantity' => 20]);

    $this->actingAs($user)->patch(route('inventory.adjust', $oil), [
        'delta' => -4.5,
        'vehicle_id' => $vehicle->id,
        'note' => 'Oil and filter',
    ])->assertRedirect();

    expect($oil->refresh()->quantity)->toEqual(15.5);

    $movement = StockMovement::firstWhere('inventory_item_id', $oil->id);

    expect((float) $movement->quantity)->toBe(-4.5)
        ->and($movement->vehicle_id)->toBe($vehicle->id)
        ->and($movement->note)->toBe('Oil and filter');
});

test('using more fluid than is on the shelf only logs what was there', function () {
    $user = User::factory()->create();
    $oil = InventoryItem::factory()->for($user)->fluid()->create(['quantity' => 2]);

    $this->actingAs($user)->patch(route('inventory.adjust', $oil), ['delta' => -5]);

    expect($oil->refresh()->quantity)->toEqual(0.0)
        ->and((float) StockMovement::firstWhere('inventory_item_id', $oil->id)->quantity)->toBe(-2.0);
});

test('an adjustment cannot name someone elses vehicle', function () {
    $user = User::factory()->create();
    $oil = InventoryItem::factory()->for($user)->fluid()->create();

    $this->actingAs($user)->patch(route('inventory.adjust', $oil), [
        'delta' => -1,
        'vehicle_id' => Vehicle::factory()->create()->id,
    ])->assertSessionHasErrors('vehicle_id');
});
