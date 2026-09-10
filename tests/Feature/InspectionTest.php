<?php

use App\Enums\ChecklistTemplate;
use App\Enums\CheckStatus;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\User;
use App\Models\Vehicle;

test('guests cannot see the checklist list', function () {
    $this->get(route('inspections.index'))->assertRedirect(route('login'));
});

test('the checklist list only shows checklists owned by the user', function () {
    $user = User::factory()->create();
    $own = Inspection::factory()->for($user)->withItems()->create();
    Inspection::factory()->create();

    $this->actingAs($user)
        ->get(route('inspections.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inspections/index')
            ->has('inspections', 1)
            ->where('inspections.0.id', $own->id)
        );
});

test('the checklist list can be filtered by vehicle', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $match = Inspection::factory()->for($user)->for($vehicle)->create();
    Inspection::factory()->for($user)->create();

    $this->actingAs($user)
        ->get(route('inspections.index', ['vehicle' => $vehicle->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('inspections', 1)->where('inspections.0.id', $match->id));
});

test('the picker offers the vehicles and every checklist', function () {
    $user = User::factory()->create();
    Vehicle::factory()->for($user)->create();

    $this->actingAs($user)
        ->get(route('inspections.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inspections/create')
            ->has('vehicles', 1)
            ->has('templates', count(ChecklistTemplate::cases()))
        );
});

test('starting a checklist builds its items from the template', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $response = $this->actingAs($user)->post(route('inspections.store'), [
        'vehicle_id' => $vehicle->id,
        'template' => ChecklistTemplate::BasicService->value,
        'performed_on' => '2026-09-10',
        'odometer' => 128000,
    ]);

    $inspection = Inspection::firstOrFail();

    $response->assertRedirect(route('inspections.show', $inspection));
    expect($inspection->user_id)->toBe($user->id)
        ->and($inspection->title)->toBe(ChecklistTemplate::BasicService->label())
        ->and($inspection->items()->count())->toBe(ChecklistTemplate::BasicService->itemCount())
        ->and($inspection->items()->first()->status)->toBe(CheckStatus::Pending);
});

test('a checklist cannot be started against someone elses vehicle', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();

    $this->actingAs($user)
        ->post(route('inspections.store'), [
            'vehicle_id' => $vehicle->id,
            'template' => ChecklistTemplate::BasicService->value,
            'performed_on' => '2026-09-10',
        ])
        ->assertSessionHasErrors('vehicle_id');

    expect(Inspection::count())->toBe(0);
});

test('starting a checklist requires a vehicle and a known template', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('inspections.store'), ['template' => 'made_up', 'performed_on' => 'nope'])
        ->assertSessionHasErrors(['vehicle_id', 'template', 'performed_on']);
});

test('a checklist page lists every item to check', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create([
        'template' => ChecklistTemplate::BasicService,
    ]);

    $this->actingAs($user)
        ->get(route('inspections.show', $inspection))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inspections/show')
            ->has('inspection.items', ChecklistTemplate::BasicService->itemCount())
        );
});

test('a checklist belonging to someone else cannot be viewed', function () {
    $inspection = Inspection::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('inspections.show', $inspection))
        ->assertForbidden();
});

test('an item can be checked off with a note', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->create();
    $item = InspectionItem::factory()->for($inspection)->create();

    $this->actingAs($user)
        ->patch(route('inspection-items.update', $item), [
            'status' => CheckStatus::Attention->value,
            'notes' => 'Weeping slightly.',
        ])
        ->assertRedirect();

    expect($item->refresh()->status)->toBe(CheckStatus::Attention)
        ->and($item->notes)->toBe('Weeping slightly.');
});

test('an item on someone elses checklist cannot be changed', function () {
    $item = InspectionItem::factory()->for(Inspection::factory())->create();

    $this->actingAs(User::factory()->create())
        ->patch(route('inspection-items.update', $item), ['status' => CheckStatus::Good->value])
        ->assertForbidden();

    expect($item->refresh()->status)->toBe(CheckStatus::Pending);
});

test('a checklist can be signed off and reopened', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->create();

    $this->actingAs($user)
        ->patch(route('inspections.update', $inspection), ['completed' => true, 'notes' => 'All good.'])
        ->assertRedirect();

    expect($inspection->refresh()->completed_at)->not->toBeNull()
        ->and($inspection->notes)->toBe('All good.');

    $this->actingAs($user)->patch(route('inspections.update', $inspection), ['completed' => false]);

    expect($inspection->refresh()->completed_at)->toBeNull();
});

test('a checklist can be deleted with its items', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create();

    $this->actingAs($user)
        ->delete(route('inspections.destroy', $inspection))
        ->assertRedirect(route('inspections.index'));

    expect(Inspection::count())->toBe(0)
        ->and(InspectionItem::count())->toBe(0);
});

test('an item can be marked good, needs attention or fixed', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->create();
    $item = InspectionItem::factory()->for($inspection)->create();

    foreach (CheckStatus::choices() as $status) {
        $this->actingAs($user)
            ->patch(route('inspection-items.update', $item), ['status' => $status->value])
            ->assertRedirect();

        expect($item->refresh()->status)->toBe($status);
    }
});

test('only the items left needing attention count as outstanding work', function () {
    expect(CheckStatus::Attention->needsWork())->toBeTrue()
        ->and(CheckStatus::Fixed->needsWork())->toBeFalse()
        ->and(CheckStatus::Good->needsWork())->toBeFalse();
});
