<?php

use App\Enums\CheckStatus;
use App\Enums\MachineKind;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

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

test('adding a vehicle with a vin decodes and stores its specs and kind', function () {
    Http::fake(['vpic.nhtsa.dot.gov/*' => Http::response(['Results' => [[
        'Make' => 'FORD',
        'Model' => 'Ranger',
        'ModelYear' => '2020',
        'BodyClass' => 'Pickup',
        'VehicleType' => 'TRUCK',
        'EngineCylinders' => '5',
        'DisplacementL' => '3.2',
        'FuelTypePrimary' => 'Diesel',
        'ErrorCode' => '0',
    ]]])]);

    $user = User::factory()->create();

    $this->actingAs($user)->post(route('vehicles.store'), [
        'make' => 'Ford',
        'model' => 'Ranger',
        'year' => 2020,
        'vin' => 'mfbumef50lw123456',
    ]);

    $vehicle = Vehicle::firstOrFail();

    expect($vehicle->vin)->toBe('MFBUMEF50LW123456')
        ->and($vehicle->kind)->toBe(MachineKind::Ute)
        ->and($vehicle->specs['source'])->toBe('nhtsa')
        ->and($vehicle->engine()['cylinders'])->toBe(5)
        ->and($vehicle->engine_summary)->toBe('3.2 L 5-cyl diesel');
});

test('typed engine details win over the decoder and a serial number needs no decode', function () {
    Http::fake();

    $user = User::factory()->create();

    $this->actingAs($user)->post(route('vehicles.store'), [
        'make' => 'Kubota',
        'model' => 'ZD1211',
        'year' => 2019,
        'vin' => 'KH 55321',
        'kind' => 'mower',
        'cylinders' => 3,
        'displacement_l' => 1.12,
        'fuel' => 'Diesel',
    ]);

    $vehicle = Vehicle::firstOrFail();

    Http::assertNothingSent();
    expect($vehicle->kind)->toBe(MachineKind::Mower)
        ->and($vehicle->specs['source'])->toBe('manual')
        ->and($vehicle->engine())->toMatchArray(['cylinders' => 3, 'displacement_l' => 1.12, 'fuel' => 'Diesel']);
});

test('updating a vehicle keeps its decoded specs when the vin has not changed', function () {
    Http::fake();

    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create([
        'vin' => 'MFBUMEF50LW123456',
        'kind' => MachineKind::Ute,
        'specs' => ['source' => 'nhtsa', 'kind' => 'ute', 'engine' => ['cylinders' => 5, 'fuel' => 'Diesel']],
    ]);

    $this->actingAs($user)->put(route('vehicles.update', $vehicle), [
        'make' => $vehicle->make,
        'model' => $vehicle->model,
        'year' => $vehicle->year,
        'vin' => 'MFBUMEF50LW123456',
        'cylinders' => 5,
        'displacement_l' => 3.2,
    ]);

    Http::assertNothingSent();
    expect($vehicle->refresh()->specs['source'])->toBe('nhtsa')
        ->and($vehicle->engine()['displacement_l'])->toBe(3.2);
});

test('a vehicle page carries its specs, service schedule, common repairs and deferred recalls', function () {
    Http::fake(['api.nhtsa.gov/*' => Http::response(['results' => [[
        'NHTSACampaignNumber' => '20V123000',
        'ReportReceivedDate' => '24/07/2020',
        'Component' => 'FUEL SYSTEM, DIESEL',
        'Summary' => 'The fuel line may chafe.',
        'Consequence' => 'A fuel leak increases the risk of a fire.',
        'Remedy' => 'Dealers will replace the fuel line free of charge.',
    ]]])]);

    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create([
        'make' => 'Ford',
        'model' => 'Ranger',
        'year' => 2020,
        'kind' => MachineKind::Ute,
        'specs' => ['source' => 'nhtsa', 'engine' => ['cylinders' => 5, 'displacement_l' => 3.2, 'fuel' => 'Diesel']],
    ]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('vehicle.kind', 'ute')
            ->where('vehicle.engine_summary', '3.2 L 5-cyl diesel')
            ->where('maintenance.0.items.4', 'Drain the water trap on the fuel filter')
            ->has('repairs.0.causes')
            ->missing('recalls')
        );

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle), [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => Inertia::getVersion(),
            'X-Inertia-Partial-Component' => 'vehicles/show',
            'X-Inertia-Partial-Data' => 'recalls',
        ])
        ->assertOk()
        ->assertJsonCount(1, 'props.recalls')
        ->assertJsonPath('props.recalls.0.campaign', '20V123000')
        ->assertJsonPath('props.recalls.0.date', '2020-07-24');
});
