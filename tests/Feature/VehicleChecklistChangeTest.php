<?php

use App\Enums\ChecklistTemplate;
use App\Enums\CheckStatus;
use App\Enums\RepairPartsStatus;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleChecklistChange;

/**
 * Start a checklist for the vehicle the way the picker does, and get back
 * the checklist it built.
 */
function startChecklistFor(User $user, Vehicle $vehicle, ChecklistTemplate $template = ChecklistTemplate::MonthlyCheck): Inspection
{
    test()->actingAs($user)->post(route('inspections.store'), [
        'vehicle_id' => $vehicle->id,
        'template' => $template->value,
        'performed_on' => '2026-09-29',
    ])->assertSessionHasNoErrors();

    return Inspection::query()->where('vehicle_id', $vehicle->id)->where('template', $template)->sole();
}

test('a check added to a checklist goes on it and is remembered for the vehicle', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['section' => 'Fluids', 'label' => 'Power steering fluid'])
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Check added, and remembered for this vehicle.');

    $item = $inspection->items()->where('label', 'Power steering fluid')->sole();
    expect($item->section)->toBe('Fluids')
        ->and($item->status)->toBe(CheckStatus::Pending)
        ->and($item->position)->toBe(ChecklistTemplate::MonthlyCheck->itemCount());

    $this->assertDatabaseHas('vehicle_checklist_changes', [
        'vehicle_id' => $inspection->vehicle_id,
        'template' => ChecklistTemplate::MonthlyCheck->value,
        'section' => 'Fluids',
        'label' => 'Power steering fluid',
        'action' => 'add',
    ]);
});

test('a check added without a section goes under extra checks', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['label' => 'Tow hitch pin and clip'])
        ->assertRedirect();

    expect($inspection->items()->where('label', 'Tow hitch pin and clip')->sole()->section)->toBe('Extra checks');
});

test('a check taken off a checklist is left off for the vehicle', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);
    $item = $inspection->items()->where('label', 'Washer fluid level')->sole();

    $this->actingAs($user)
        ->delete(route('inspection-items.destroy', $item))
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Check removed, and left off for this vehicle.');

    $this->assertModelMissing($item);
    $this->assertDatabaseHas('vehicle_checklist_changes', [
        'vehicle_id' => $inspection->vehicle_id,
        'template' => ChecklistTemplate::MonthlyCheck->value,
        'section' => 'Fluids',
        'label' => 'Washer fluid level',
        'action' => 'remove',
    ]);
});

test('taking off a flagged check throws away the repair planned for it', function () {
    $user = User::factory()->create();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Planned]);
    $planned = ServiceRecord::factory()->planned()->create(['inspection_item_id' => $item->id]);

    $this->actingAs($user)->delete(route('inspection-items.destroy', $item))->assertRedirect();

    $this->assertModelMissing($item);
    $this->assertModelMissing($planned);
});

test('changes made for this checklist only are not remembered', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);
    $washer = $inspection->items()->where('label', 'Washer fluid level')->sole();

    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['section' => 'Fluids', 'label' => 'Power steering fluid', 'remember' => false])
        ->assertInertiaFlash('toast.message', 'Check added to this checklist.');

    $this->actingAs($user)
        ->delete(route('inspection-items.destroy', ['inspectionItem' => $washer, 'remember' => 0]))
        ->assertInertiaFlash('toast.message', 'Check removed from this checklist.');

    expect($inspection->items()->where('label', 'Power steering fluid')->exists())->toBeTrue();
    $this->assertModelMissing($washer);
    $this->assertDatabaseCount('vehicle_checklist_changes', 0);
});

test("a vehicle's next checklist of the same kind has its checks added and left off", function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    VehicleChecklistChange::factory()->for($vehicle)->create([
        'template' => ChecklistTemplate::MonthlyCheck,
        'section' => 'Fluids',
        'label' => 'Power steering fluid',
    ]);
    VehicleChecklistChange::factory()->for($vehicle)->removal('Washer fluid level')->create([
        'template' => ChecklistTemplate::MonthlyCheck,
    ]);

    $inspection = startChecklistFor($user, $vehicle);

    expect($inspection->template)->toBe(ChecklistTemplate::MonthlyCheck)
        ->and($inspection->items()->where('section', 'Fluids')->pluck('label')->all())->toBe([
            'Engine oil level',
            'Coolant level',
            'Brake fluid level',
            'No fresh leaks under the vehicle',
            'Power steering fluid',
        ])
        ->and($inspection->items()->count())->toBe(ChecklistTemplate::MonthlyCheck->itemCount());
});

test("a vehicle's changes to one checklist leave other checklists and other vehicles alone", function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    VehicleChecklistChange::factory()->for($vehicle)->create(['template' => ChecklistTemplate::MonthlyCheck, 'label' => 'Canopy seals']);
    VehicleChecklistChange::factory()->for($vehicle)->removal('Washer fluid level')->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $service = startChecklistFor($user, $vehicle, ChecklistTemplate::BasicService);
    $otherVehicle = startChecklistFor($user, Vehicle::factory()->create());

    expect($service->items()->count())->toBe(ChecklistTemplate::BasicService->itemCount())
        ->and($service->items()->where('label', 'Canopy seals')->exists())->toBeFalse()
        ->and($otherVehicle->items()->count())->toBe(ChecklistTemplate::MonthlyCheck->itemCount())
        ->and($otherVehicle->items()->where('label', 'Washer fluid level')->exists())->toBeTrue()
        ->and($otherVehicle->items()->where('label', 'Canopy seals')->exists())->toBeFalse();
});

test('taking off an added check forgets it, and putting back a left-off check forgets leaving it off', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    VehicleChecklistChange::factory()->for($vehicle)->create([
        'template' => ChecklistTemplate::MonthlyCheck,
        'section' => 'Fluids',
        'label' => 'Power steering fluid',
    ]);
    VehicleChecklistChange::factory()->for($vehicle)->removal('Washer fluid level')->create([
        'template' => ChecklistTemplate::MonthlyCheck,
    ]);
    $inspection = startChecklistFor($user, $vehicle);

    $this->actingAs($user)
        ->delete(route('inspection-items.destroy', $inspection->items()->where('label', 'Power steering fluid')->sole()))
        ->assertRedirect();
    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['section' => 'Fluids', 'label' => 'Washer fluid level'])
        ->assertRedirect();

    $this->assertDatabaseCount('vehicle_checklist_changes', 0);
    expect($inspection->items()->where('label', 'Washer fluid level')->exists())->toBeTrue();
});

test("resetting puts a vehicle's copy of one checklist back to the standard list", function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    VehicleChecklistChange::factory()->for($vehicle)->create(['template' => ChecklistTemplate::MonthlyCheck]);
    VehicleChecklistChange::factory()->for($vehicle)->removal('Washer fluid level')->create(['template' => ChecklistTemplate::MonthlyCheck]);
    $kept = VehicleChecklistChange::factory()->for($vehicle)->create(['template' => ChecklistTemplate::BasicService]);

    $this->actingAs($user)
        ->delete(route('vehicles.checklist-changes.destroy', [$vehicle, ChecklistTemplate::MonthlyCheck->value]))
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'The monthly check for this vehicle is back to the standard list.');

    expect(VehicleChecklistChange::query()->pluck('id')->all())->toBe([$kept->id]);
});

test('an added check has to say what needs checking', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['section' => 'Fluids', 'label' => '  '])
        ->assertSessionHasErrors(['label' => 'Say what needs checking.']);

    expect($inspection->items()->count())->toBe(ChecklistTemplate::MonthlyCheck->itemCount());
});

test('a check cannot go on the same section of a checklist twice', function () {
    $user = User::factory()->create();
    $inspection = Inspection::factory()->for($user)->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $this->actingAs($user)
        ->post(route('inspection-items.store', $inspection), ['section' => 'Fluids', 'label' => 'Coolant level'])
        ->assertSessionHasErrors(['label' => 'That check is already on the list.']);

    $this->assertDatabaseCount('vehicle_checklist_changes', 0);
});

test("a shopper cannot change a checklist or reset a vehicle's copy of one", function () {
    $shopper = User::factory()->shopper()->create();
    $inspection = Inspection::factory()->withItems()->create(['template' => ChecklistTemplate::MonthlyCheck]);
    $item = $inspection->items()->first();

    $this->actingAs($shopper)
        ->post(route('inspection-items.store', $inspection), ['label' => 'Power steering fluid'])
        ->assertForbidden();
    $this->actingAs($shopper)
        ->delete(route('inspection-items.destroy', $item))
        ->assertForbidden();
    $this->actingAs($shopper)
        ->delete(route('vehicles.checklist-changes.destroy', [$inspection->vehicle_id, ChecklistTemplate::MonthlyCheck->value]))
        ->assertForbidden();

    $this->assertModelExists($item);
    expect($inspection->items()->count())->toBe(ChecklistTemplate::MonthlyCheck->itemCount());
});

test("the picker and the checklist show what has been changed on the vehicle's copy", function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    VehicleChecklistChange::factory()->for($vehicle)->create([
        'template' => ChecklistTemplate::MonthlyCheck,
        'section' => 'Fluids',
        'label' => 'Power steering fluid',
    ]);
    VehicleChecklistChange::factory()->for($vehicle)->removal('Washer fluid level')->create(['template' => ChecklistTemplate::MonthlyCheck]);
    $inspection = Inspection::factory()->for($user)->for($vehicle)->create(['template' => ChecklistTemplate::MonthlyCheck]);

    $this->actingAs($user)
        ->get(route('inspections.create'))
        ->assertInertia(fn ($page) => $page
            ->where("checklistChanges.{$vehicle->id}.monthly_check.added", [['section' => 'Fluids', 'label' => 'Power steering fluid']])
            ->where("checklistChanges.{$vehicle->id}.monthly_check.removed", [['section' => 'Fluids', 'label' => 'Washer fluid level']]));

    $this->actingAs($user)
        ->get(route('inspections.show', $inspection))
        ->assertInertia(fn ($page) => $page
            ->where('vehicleChanges.added', [['section' => 'Fluids', 'label' => 'Power steering fluid']])
            ->where('vehicleChanges.removed', [['section' => 'Fluids', 'label' => 'Washer fluid level']]));
});
