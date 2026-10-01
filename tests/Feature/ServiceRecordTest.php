<?php

use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;

test('guests cannot see the service log', function () {
    $this->get(route('service-records.index'))->assertRedirect(route('login'));
});

test('the service log shows every job in the shop, whoever logged it', function () {
    $user = User::factory()->create();
    ServiceRecord::factory()->for($user)->for(Vehicle::factory()->for($user))->create();
    ServiceRecord::factory()->create();

    $this->actingAs($user)
        ->get(route('service-records.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('service-records/index')
            ->has('records', 2)
        );
});

test('the service log can be filtered by vehicle and status', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $other = Vehicle::factory()->for($user)->create();

    $match = ServiceRecord::factory()->for($user)->for($vehicle)->planned()->create();
    ServiceRecord::factory()->for($user)->for($vehicle)->create();
    ServiceRecord::factory()->for($user)->for($other)->planned()->create();

    $this->actingAs($user)
        ->get(route('service-records.index', ['vehicle' => $vehicle->id, 'status' => 'planned']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('records', 1)->where('records.0.id', $match->id));
});

test('a job can be opened to see its full detail', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $record = ServiceRecord::factory()->for($user)->for($vehicle)->create(['title' => 'Front brake pads']);

    $this->actingAs($user)
        ->get(route('service-records.show', $record))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('service-records/show')
            ->where('record.id', $record->id)
            ->where('record.title', 'Front brake pads')
        );
});

test('a shopper cannot open a job', function () {
    $user = User::factory()->shopper()->create();
    $record = ServiceRecord::factory()->create();

    $this->actingAs($user)->get(route('service-records.show', $record))->assertForbidden();
});

test('a job can be logged against a vehicle', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('service-records.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Front brake pads',
            'type' => ServiceType::Brakes->value,
            'status' => ServiceStatus::Completed->value,
            'performed_on' => '2026-09-01',
            'odometer' => 128000,
            'hours' => 2.5,
            'parts_cost' => 240,
            'labour_cost' => 180,
        ])
        ->assertRedirect(route('service-records.index'));

    $record = ServiceRecord::firstOrFail();

    expect($record->user_id)->toBe($user->id)
        ->and($record->vehicle_id)->toBe($vehicle->id)
        ->and($record->type)->toBe(ServiceType::Brakes)
        ->and($record->total_cost)->toBe(420.0);
});

test('optional cost fields default to zero', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)->post(route('service-records.store'), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Quick look over',
        'type' => ServiceType::Inspection->value,
        'status' => ServiceStatus::Completed->value,
        'performed_on' => '2026-09-01',
    ])->assertSessionHasNoErrors();

    expect(ServiceRecord::firstOrFail()->total_cost)->toBe(0.0);
});

test('a job can be logged against a vehicle another mechanic added', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();

    $this->actingAs($user)
        ->post(route('service-records.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Front brake pads',
            'type' => ServiceType::Brakes->value,
            'status' => ServiceStatus::Completed->value,
            'performed_on' => '2026-09-01',
        ])
        ->assertSessionHasNoErrors();

    expect(ServiceRecord::sole()->user_id)->toBe($user->id);
});

test('logging a job requires a title, type, status and date', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('service-records.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => '',
            'type' => 'rocket_science',
            'status' => 'napping',
            'performed_on' => 'not-a-date',
        ])
        ->assertSessionHasErrors(['title', 'type', 'status', 'performed_on']);
});

test('a job can be updated by its owner', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $record = ServiceRecord::factory()->for($user)->for($vehicle)->create(['title' => 'Oil change']);

    $this->actingAs($user)
        ->put(route('service-records.update', $record), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Oil and filter change',
            'type' => ServiceType::OilChange->value,
            'status' => ServiceStatus::InProgress->value,
            'performed_on' => '2026-09-02',
        ])
        ->assertRedirect(route('service-records.index'));

    expect($record->refresh()->title)->toBe('Oil and filter change')
        ->and($record->status)->toBe(ServiceStatus::InProgress);
});

test('a job can be deleted by its owner', function () {
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->for($user)->for(Vehicle::factory()->for($user))->create();

    $this->actingAs($user)
        ->from(route('service-records.index'))
        ->delete(route('service-records.destroy', $record))
        ->assertRedirect(route('service-records.index'));

    expect(ServiceRecord::count())->toBe(0);
});

test('a shopper cannot edit, update or delete a job', function () {
    $user = User::factory()->shopper()->create();
    $record = ServiceRecord::factory()->create(['title' => 'Not yours']);

    $this->actingAs($user)->get(route('service-records.edit', $record))->assertForbidden();
    $this->actingAs($user)->put(route('service-records.update', $record), [
        'vehicle_id' => $record->vehicle_id,
        'title' => 'Hacked',
        'type' => ServiceType::Other->value,
        'status' => ServiceStatus::Completed->value,
        'performed_on' => '2026-09-01',
    ])->assertForbidden();
    $this->actingAs($user)->delete(route('service-records.destroy', $record))->assertForbidden();

    expect($record->refresh()->title)->toBe('Not yours');
});
