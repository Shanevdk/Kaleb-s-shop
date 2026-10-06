<?php

use App\Enums\CheckStatus;
use App\Enums\EquipmentServiceType;
use App\Enums\EquipmentStatus;
use App\Enums\ServiceStatus;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentChecklistItem;
use App\Models\EquipmentServiceRecord;
use App\Models\User;

test('guests cannot see the equipment list', function () {
    $this->get(route('equipment.index'))->assertRedirect(route('login'));
});

test('the equipment list shows every record in the shop, whoever added it', function () {
    $user = User::factory()->create();
    Equipment::factory()->for($user)->create(['name' => 'Air compressor']);
    Equipment::factory()->create(['name' => 'Hydraulic lift']);

    $this->actingAs($user)
        ->get(route('equipment.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment/index')
            ->has('equipment', 2)
        );
});

test('the equipment list can be searched', function () {
    $user = User::factory()->create();
    Equipment::factory()->for($user)->create(['name' => 'Air compressor', 'category' => 'Compressor']);
    Equipment::factory()->for($user)->create(['name' => 'Hydraulic lift', 'category' => 'Lift']);

    $this->actingAs($user)
        ->get(route('equipment.index', ['search' => 'lift']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('equipment', 1)->where('equipment.0.name', 'Hydraulic lift'));
});

test('a shopper cannot view the equipment list', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('equipment.index'))
        ->assertForbidden();
});

test('equipment can be added', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('equipment.store'), [
        'name' => 'Tyre balancer',
        'category' => 'Shop tool',
        'status' => EquipmentStatus::Active->value,
    ]);

    $equipment = Equipment::firstOrFail();

    $response->assertRedirect(route('equipment.show', $equipment));
    expect($equipment->user_id)->toBe($user->id)
        ->and($equipment->name)->toBe('Tyre balancer')
        ->and($equipment->status)->toBe(EquipmentStatus::Active);
});

test('adding equipment requires a name and a valid status', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('equipment.store'), ['name' => '', 'status' => 'made_up'])
        ->assertSessionHasErrors(['name', 'status']);
});

test('the equipment page lists its checklists and service records', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create();
    EquipmentChecklist::factory()->for($user)->for($equipment)->create();
    EquipmentServiceRecord::factory()->for($user)->for($equipment)->create();

    $this->actingAs($user)
        ->get(route('equipment.show', $equipment))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment/show')
            ->has('checklists', 1)
            ->has('records', 1)
        );
});

test('a shopper cannot view a piece of equipment', function () {
    $equipment = Equipment::factory()->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('equipment.show', $equipment))
        ->assertForbidden();
});

test('equipment can be updated', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create(['status' => EquipmentStatus::Active]);

    $this->actingAs($user)
        ->put(route('equipment.update', $equipment), [
            'name' => $equipment->name,
            'status' => EquipmentStatus::OutOfService->value,
        ])
        ->assertRedirect(route('equipment.show', $equipment));

    expect($equipment->refresh()->status)->toBe(EquipmentStatus::OutOfService);
});

test('equipment can be removed', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create();

    $this->actingAs($user)
        ->delete(route('equipment.destroy', $equipment))
        ->assertRedirect(route('equipment.index'));

    expect(Equipment::find($equipment->id))->toBeNull();
});

test('a checklist can be started against a piece of equipment', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create();

    $response = $this->actingAs($user)->post(route('equipment-checklists.store', $equipment), [
        'title' => 'Safety check',
        'performed_on' => '2026-09-10',
    ]);

    $checklist = EquipmentChecklist::firstOrFail();

    $response->assertRedirect(route('equipment-checklists.show', $checklist));
    expect($checklist->user_id)->toBe($user->id)
        ->and($checklist->equipment_id)->toBe($equipment->id)
        ->and($checklist->title)->toBe('Safety check');
});

test('a check can be added to a checklist, checked off with a note, and removed', function () {
    $user = User::factory()->create();
    $checklist = EquipmentChecklist::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('equipment-checklist-items.store', $checklist), ['label' => 'Check for leaks'])
        ->assertRedirect();

    $item = EquipmentChecklistItem::sole();
    expect($item->label)->toBe('Check for leaks')
        ->and($item->status)->toBe(CheckStatus::Pending);

    $this->actingAs($user)
        ->patch(route('equipment-checklist-items.update', $item), [
            'status' => CheckStatus::Attention->value,
            'notes' => 'Weeping slightly.',
        ])
        ->assertRedirect();

    expect($item->refresh()->status)->toBe(CheckStatus::Attention)
        ->and($item->notes)->toBe('Weeping slightly.');

    $this->actingAs($user)
        ->delete(route('equipment-checklist-items.destroy', $item))
        ->assertRedirect();

    expect(EquipmentChecklistItem::find($item->id))->toBeNull();
});

test('guests cannot see the equipment checklists', function () {
    $this->get(route('equipment-checklists.index'))->assertRedirect(route('login'));
});

test('the equipment checklists list every checklist run against the equipment, newest first, with its tallies', function () {
    $user = User::factory()->create();
    $older = EquipmentChecklist::factory()->for($user)->create(['performed_on' => '2026-09-10']);
    EquipmentChecklistItem::factory()->for($older)->create(['label' => 'Check for leaks', 'status' => CheckStatus::Attention]);
    EquipmentChecklistItem::factory()->for($older)->create(['label' => 'Test emergency stop']);
    $newer = EquipmentChecklist::factory()->for($user)->create(['performed_on' => '2026-09-12']);

    $this->actingAs($user)
        ->get(route('equipment-checklists.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-checklists/index')
            ->where('division', 'main')
            ->has('checklists', 2)
            ->where('checklists.0.id', $newer->id)
            ->where('checklists.1.id', $older->id)
            ->where('checklists.1.equipment.name', $older->equipment->name)
            ->where('checklists.1.items_count', 2)
            ->where('checklists.1.checked_count', 1)
            ->where('checklists.1.flagged_count', 1)
        );
});

test('the equipment checklists can be filtered to one piece of equipment', function () {
    $user = User::factory()->create();
    $match = EquipmentChecklist::factory()->for($user)->create();
    EquipmentChecklist::factory()->for($user)->create();

    $this->actingAs($user)
        ->get(route('equipment-checklists.index', ['equipment' => $match->equipment_id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('filters.equipment', $match->equipment_id)
            ->has('checklists', 1)
            ->where('checklists.0.id', $match->id)
        );
});

test('a shopper cannot view the equipment checklists', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('equipment-checklists.index'))
        ->assertForbidden();
});

test('a shopper cannot change an equipment checklist item', function () {
    $item = EquipmentChecklistItem::factory()->for(EquipmentChecklist::factory())->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->patch(route('equipment-checklist-items.update', $item), ['status' => CheckStatus::Good->value])
        ->assertForbidden();

    expect($item->refresh()->status)->toBe(CheckStatus::Pending);
});

test('an equipment checklist can be signed off and reopened', function () {
    $user = User::factory()->create();
    $checklist = EquipmentChecklist::factory()->for($user)->create();

    $this->actingAs($user)
        ->patch(route('equipment-checklists.update', $checklist), ['completed' => true, 'notes' => 'All good.'])
        ->assertRedirect();

    expect($checklist->refresh()->completed_at)->not->toBeNull()
        ->and($checklist->notes)->toBe('All good.');

    $this->actingAs($user)->patch(route('equipment-checklists.update', $checklist), ['completed' => false]);

    expect($checklist->refresh()->completed_at)->toBeNull();
});

test('a service record can be logged, updated and removed against a piece of equipment', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('equipment-service-records.store', $equipment), [
            'title' => 'Annual service',
            'type' => EquipmentServiceType::Maintenance->value,
            'status' => ServiceStatus::Completed->value,
            'performed_on' => '2026-09-10',
            'hours' => 2,
            'parts_cost' => 50,
            'labour_cost' => 100,
        ])
        ->assertRedirect();

    $record = EquipmentServiceRecord::sole();
    expect($record->equipment_id)->toBe($equipment->id)
        ->and($record->title)->toBe('Annual service');

    $this->actingAs($user)
        ->patch(route('equipment-service-records.update', $record), [
            'title' => 'Annual service',
            'type' => EquipmentServiceType::Maintenance->value,
            'status' => ServiceStatus::Completed->value,
            'performed_on' => '2026-09-10',
            'hours' => 3,
        ])
        ->assertRedirect();

    expect((float) $record->refresh()->hours)->toBe(3.0);

    $this->actingAs($user)
        ->delete(route('equipment-service-records.destroy', $record))
        ->assertRedirect();

    expect(EquipmentServiceRecord::find($record->id))->toBeNull();
});

test('a service record can be logged over several days and its days changed', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->for($user)->create();
    $attributes = [
        'title' => 'Rebuild the hydraulics',
        'type' => EquipmentServiceType::Maintenance->value,
        'status' => ServiceStatus::Planned->value,
    ];

    $this->actingAs($user)
        ->post(route('equipment-service-records.store', $equipment), [...$attributes, 'days' => ['2026-10-13', '2026-10-12']])
        ->assertSessionHasNoErrors();

    $record = EquipmentServiceRecord::sole();
    expect($record->days())->toBe(['2026-10-12', '2026-10-13']);

    $this->actingAs($user)
        ->patch(route('equipment-service-records.update', $record), [...$attributes, 'days' => ['2026-10-12', '2026-10-13', '2026-10-15']])
        ->assertSessionHasNoErrors();

    expect($record->refresh()->days())->toBe(['2026-10-12', '2026-10-13', '2026-10-15'])
        ->and($record->finishes_on->toDateString())->toBe('2026-10-15');
});

test('guests cannot see the equipment service log', function () {
    $this->get(route('equipment-service-records.index'))->assertRedirect(route('login'));
});

test('the equipment service log lists records across every piece of equipment', function () {
    $user = User::factory()->create();
    $one = Equipment::factory()->for($user)->create();
    $two = Equipment::factory()->for($user)->create();
    EquipmentServiceRecord::factory()->for($user)->for($one)->create();
    EquipmentServiceRecord::factory()->for($user)->for($two)->create();

    $this->actingAs($user)
        ->get(route('equipment-service-records.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-service-records/index')
            ->has('records', 2)
        );
});

test('the equipment service log can be filtered to one piece of equipment', function () {
    $user = User::factory()->create();
    $one = Equipment::factory()->for($user)->create();
    $two = Equipment::factory()->for($user)->create();
    $match = EquipmentServiceRecord::factory()->for($user)->for($one)->create();
    EquipmentServiceRecord::factory()->for($user)->for($two)->create();

    $this->actingAs($user)
        ->get(route('equipment-service-records.index', ['equipment' => $one->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('records', 1)->where('records.0.id', $match->id));
});

test('a shopper cannot view the equipment service log', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('equipment-service-records.index'))
        ->assertForbidden();
});
