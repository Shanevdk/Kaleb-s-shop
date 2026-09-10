<?php

use App\Enums\CheckStatus;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;

test('guests cannot see the vehicle list', function () {
    $this->get(route('vehicles.index'))->assertRedirect(route('login'));
});

test('the vehicle list only shows vehicles owned by the user', function () {
    $user = User::factory()->create();
    $own = Vehicle::factory()->for($user)->create(['make' => 'Toyota']);
    Vehicle::factory()->create(['make' => 'Ferrari']);

    $this->actingAs($user)
        ->get(route('vehicles.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('vehicles/index')
            ->has('vehicles', 1)
            ->where('vehicles.0.id', $own->id)
        );
});

test('the vehicle list can be searched', function () {
    $user = User::factory()->create();
    Vehicle::factory()->for($user)->create(['make' => 'Toyota', 'model' => 'Hilux']);
    Vehicle::factory()->for($user)->create(['make' => 'Ford', 'model' => 'Ranger']);

    $this->actingAs($user)
        ->get(route('vehicles.index', ['search' => 'Ranger']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('vehicles', 1)->where('vehicles.0.model', 'Ranger'));
});

test('a vehicle can be added', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('vehicles.store'), [
        'make' => 'Toyota',
        'model' => 'Hilux',
        'year' => 2018,
        'nickname' => 'Work ute',
        'registration' => 'ABC123',
        'odometer' => 128000,
    ]);

    $vehicle = Vehicle::firstOrFail();

    $response->assertRedirect(route('vehicles.show', $vehicle));
    expect($vehicle->user_id)->toBe($user->id)
        ->and($vehicle->display_name)->toBe('Work ute');
});

test('adding a vehicle requires a make, model and valid year', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('vehicles.store'), ['make' => '', 'model' => '', 'year' => 1800])
        ->assertSessionHasErrors(['make', 'model', 'year']);

    expect(Vehicle::count())->toBe(0);
});

test('a vehicle page shows its service history and totals', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    ServiceRecord::factory()->for($user)->for($vehicle)->create([
        'hours' => 2.5,
        'parts_cost' => 100,
        'labour_cost' => 150,
    ]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('vehicles/show')
            ->has('records', 1)
            ->where('stats.hours', 2.5)
            ->where('stats.spend', 250)
        );
});

test('a vehicle can be updated by its owner', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create(['model' => 'Hilux']);

    $this->actingAs($user)
        ->put(route('vehicles.update', $vehicle), [
            'make' => $vehicle->make,
            'model' => 'Land Cruiser',
            'year' => $vehicle->year,
        ])
        ->assertRedirect(route('vehicles.show', $vehicle));

    expect($vehicle->refresh()->model)->toBe('Land Cruiser');
});

test('a vehicle can be deleted with its service history', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    ServiceRecord::factory()->for($user)->for($vehicle)->create();

    $this->actingAs($user)
        ->delete(route('vehicles.destroy', $vehicle))
        ->assertRedirect(route('vehicles.index'));

    expect(Vehicle::count())->toBe(0)
        ->and(ServiceRecord::count())->toBe(0);
});

test('a user cannot view, update or delete another mechanic vehicle', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();

    $this->actingAs($user)->get(route('vehicles.show', $vehicle))->assertForbidden();
    $this->actingAs($user)->get(route('vehicles.edit', $vehicle))->assertForbidden();
    $this->actingAs($user)->put(route('vehicles.update', $vehicle), [
        'make' => 'Hacked',
        'model' => 'Hacked',
        'year' => 2020,
    ])->assertForbidden();
    $this->actingAs($user)->delete(route('vehicles.destroy', $vehicle))->assertForbidden();

    expect($vehicle->refresh()->make)->not->toBe('Hacked');
});

test('a vehicle page lists every checklist run against it with its tallies', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $inspection = Inspection::factory()->for($user)->for($vehicle)->create();

    InspectionItem::factory()->for($inspection)->create(['status' => CheckStatus::Attention]);
    InspectionItem::factory()->for($inspection)->create(['status' => CheckStatus::Fixed]);
    InspectionItem::factory()->for($inspection)->create(['status' => CheckStatus::Good]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('inspections', 1)
            ->where('inspections.0.id', $inspection->id)
            ->where('inspections.0.items_count', 3)
            ->where('inspections.0.checked_count', 3)
            ->where('inspections.0.flagged_count', 1)
            ->where('inspections.0.fixed_count', 1)
            ->where('stats.needs_attention', 1)
        );
});

test('a vehicle can be deleted with its checklists', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $inspection = Inspection::factory()->for($user)->for($vehicle)->create();
    InspectionItem::factory()->for($inspection)->create();

    $this->actingAs($user)->delete(route('vehicles.destroy', $vehicle));

    expect(Inspection::count())->toBe(0)
        ->and(InspectionItem::count())->toBe(0);
});
