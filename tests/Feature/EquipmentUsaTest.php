<?php

use App\Enums\EquipmentDivision;
use App\Enums\EquipmentServiceType;
use App\Enums\EquipmentStatus;
use App\Enums\ServiceStatus;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentServiceRecord;
use App\Models\User;

test('guests cannot see the VDK Equipment USA equipment list', function () {
    $this->get(route('usa.equipment.index'))->assertRedirect(route('login'));
});

test('an account without the VDK Equipment USA permission cannot open its lists', function (string $route) {
    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->get(route($route))
        ->assertForbidden();
})->with([
    'usa.equipment.index',
    'usa.equipment.create',
    'usa.equipment-checklists.index',
    'usa.equipment-service-records.index',
    'usa.equipment-schedule.index',
]);

test('an account without the VDK Equipment USA permission cannot add equipment to it', function () {
    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->post(route('usa.equipment.store'), [
            'name' => 'Skid steer',
            'status' => EquipmentStatus::Active->value,
        ])
        ->assertForbidden();

    expect(Equipment::count())->toBe(0);
});

test('each division lists only its own equipment', function () {
    $user = User::factory()->create();
    Equipment::factory()->create(['name' => 'Air compressor']);
    Equipment::factory()->usa()->create(['name' => 'Hydraulic lift']);

    $this->actingAs($user)
        ->get(route('usa.equipment.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment/index')
            ->where('division', 'usa')
            ->has('equipment', 1)
            ->where('equipment.0.name', 'Hydraulic lift')
        );

    $this->actingAs($user)
        ->get(route('equipment.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('division', 'main')
            ->has('equipment', 1)
            ->where('equipment.0.name', 'Air compressor')
        );
});

test('the add equipment page knows which division it adds to', function (string $route, string $division) {
    $this->actingAs(User::factory()->create())
        ->get(route($route))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('equipment/create')->where('division', $division));
})->with([
    'VDK-Equipment' => ['equipment.create', 'main'],
    'VDK Equipment USA' => ['usa.equipment.create', 'usa'],
]);

test('equipment added from the VDK Equipment USA list belongs to VDK Equipment USA', function () {
    $user = User::factory()->shopper()->create(['permissions' => ['equipment-usa']]);

    $response = $this->actingAs($user)->post(route('usa.equipment.store'), [
        'name' => 'Skid steer',
        'status' => EquipmentStatus::Active->value,
    ]);

    $equipment = Equipment::sole();

    $response->assertRedirect(route('equipment.show', $equipment));
    expect($equipment->division)->toBe(EquipmentDivision::Usa)
        ->and($equipment->user_id)->toBe($user->id)
        ->and($equipment->name)->toBe('Skid steer');
});

test('an account with only the VDK Equipment USA permission can open its equipment and log work against it', function () {
    $user = User::factory()->shopper()->create(['permissions' => ['equipment-usa']]);
    $equipment = Equipment::factory()->usa()->create();

    $this->actingAs($user)
        ->get(route('equipment.show', $equipment))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment/show')
            ->where('equipment.division', 'usa')
            ->where('auth.can.equipmentUsa', true)
            ->where('auth.can.equipment', false)
        );

    $this->actingAs($user)
        ->post(route('equipment-service-records.store', $equipment), [
            'title' => 'Annual service',
            'type' => EquipmentServiceType::Maintenance->value,
            'status' => ServiceStatus::Completed->value,
            'performed_on' => '2026-09-10',
        ])
        ->assertRedirect();

    expect(EquipmentServiceRecord::sole()->equipment_id)->toBe($equipment->id);
});

test('an account with only the VDK-Equipment permission cannot open VDK Equipment USA equipment', function () {
    $equipment = Equipment::factory()->usa()->create();

    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->get(route('equipment.show', $equipment))
        ->assertForbidden();
});

test('equipment, its checklists and its service records take the permission for its own division', function (string $division, string $permission, bool $allowed) {
    $user = User::factory()->shopper()->create(['permissions' => [$permission]]);
    $equipment = Equipment::factory()->create(['division' => $division]);
    $checklist = EquipmentChecklist::factory()->for($equipment)->create();
    $record = EquipmentServiceRecord::factory()->for($equipment)->create();

    foreach (['view', 'update', 'delete'] as $ability) {
        expect($user->can($ability, $equipment))->toBe($allowed, "{$ability} the equipment")
            ->and($user->can($ability, $checklist))->toBe($allowed, "{$ability} a checklist")
            ->and($user->can($ability, $record))->toBe($allowed, "{$ability} a service record");
    }
})->with([
    'VDK-Equipment with its own permission' => ['main', 'equipment', true],
    'VDK-Equipment with only the USA permission' => ['main', 'equipment-usa', false],
    'VDK Equipment USA with its own permission' => ['usa', 'equipment-usa', true],
    'VDK Equipment USA with only the VDK-Equipment permission' => ['usa', 'equipment', false],
]);

test('maintenance cannot be put on the schedule for equipment in a division the account cannot open', function () {
    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->post(route('equipment-schedule.jobs.store'), [
            'equipment_id' => Equipment::factory()->usa()->create()->id,
            'title' => 'Replace hydraulic filter',
            'type' => EquipmentServiceType::Maintenance->value,
            'performed_on' => '2026-09-21',
        ])
        ->assertForbidden();

    expect(EquipmentServiceRecord::count())->toBe(0);
});

test('maintenance in a division the account cannot open cannot be moved or taken off the schedule', function () {
    $user = User::factory()->shopper()->create(['permissions' => ['equipment']]);
    $job = EquipmentServiceRecord::factory()
        ->planned()
        ->for(Equipment::factory()->usa())
        ->create(['performed_on' => '2026-09-16']);

    $this->actingAs($user)
        ->patch(route('equipment-schedule.jobs.update', $job), ['performed_on' => '2026-09-25'])
        ->assertForbidden();
    $this->actingAs($user)
        ->delete(route('equipment-schedule.jobs.destroy', $job))
        ->assertForbidden();

    expect($job->fresh()->performed_on->toDateString())->toBe('2026-09-16');
});

test('the VDK Equipment USA checklists list only those run against its own equipment', function () {
    $equipment = Equipment::factory()->usa()->create();
    $checklist = EquipmentChecklist::factory()->for($equipment)->create();
    EquipmentChecklist::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('usa.equipment-checklists.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-checklists/index')
            ->where('division', 'usa')
            ->has('checklists', 1)
            ->where('checklists.0.id', $checklist->id)
            ->has('equipment', 1)
            ->where('equipment.0.value', $equipment->id)
        );
});

test('the VDK Equipment USA checklists ignore a filter for the other division\'s equipment', function () {
    $checklist = EquipmentChecklist::factory()->for(Equipment::factory()->usa())->create();
    $otherDivisionEquipment = Equipment::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('usa.equipment-checklists.index', ['equipment' => $otherDivisionEquipment->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('filters.equipment', '')
            ->has('checklists', 1)
            ->where('checklists.0.id', $checklist->id)
        );
});

test('the VDK Equipment USA service log lists only work on its own equipment', function () {
    $equipment = Equipment::factory()->usa()->create();
    $record = EquipmentServiceRecord::factory()->for($equipment)->create();
    EquipmentServiceRecord::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('usa.equipment-service-records.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-service-records/index')
            ->where('division', 'usa')
            ->has('records', 1)
            ->where('records.0.id', $record->id)
            ->has('equipment', 1)
            ->where('equipment.0.value', $equipment->id)
        );
});

test('the VDK Equipment USA service log ignores a filter for the other division\'s equipment', function () {
    $record = EquipmentServiceRecord::factory()->for(Equipment::factory()->usa())->create();
    $otherDivisionEquipment = Equipment::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('usa.equipment-service-records.index', ['equipment' => $otherDivisionEquipment->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('filters.equipment', '')
            ->has('records', 1)
            ->where('records.0.id', $record->id)
        );
});

test('the VDK Equipment USA maintenance schedule shows only its own maintenance and checklists', function () {
    $this->travelTo('2026-09-15 10:00:00');
    $equipment = Equipment::factory()->usa()->create();
    $job = EquipmentServiceRecord::factory()->planned()->for($equipment)->create(['performed_on' => '2026-09-10']);
    $checklist = EquipmentChecklist::factory()->for($equipment)->create(['performed_on' => '2026-09-14']);
    EquipmentServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-11']);
    EquipmentChecklist::factory()->create(['performed_on' => '2026-09-12']);

    $this->actingAs(User::factory()->create())
        ->get(route('usa.equipment-schedule.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-schedule/index')
            ->where('division', 'usa')
            ->where('entries', fn ($entries) => collect($entries)->pluck('id')->all() === [$job->id, $checklist->id])
            ->has('equipment', 1)
            ->where('equipment.0.value', $equipment->id)
        );
});

test('removing VDK Equipment USA equipment goes back to its equipment list', function () {
    $equipment = Equipment::factory()->usa()->create();

    $this->actingAs(User::factory()->create())
        ->delete(route('equipment.destroy', $equipment))
        ->assertRedirect(route('usa.equipment.index'));

    expect(Equipment::find($equipment->id))->toBeNull();
});
