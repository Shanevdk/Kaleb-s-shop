<?php

use App\Enums\ServiceStatus;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentServiceRecord;
use App\Models\ServiceRecord;
use App\Models\User;

beforeEach(function () {
    // A Tuesday.
    $this->travelTo('2026-09-15 10:00:00');
});

test('guests cannot see the equipment schedule', function () {
    $this->get(route('equipment-schedule.index'))->assertRedirect(route('login'));
});

test('a scheduler without equipment access cannot see the equipment schedule', function () {
    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('equipment-schedule.index'))
        ->assertForbidden();
});

test('the equipment schedule shows the month of maintenance and checklists, and no vehicle jobs', function () {
    $planned = EquipmentServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-10', 'title' => 'Replace belt']);
    $done = EquipmentServiceRecord::factory()->create(['performed_on' => '2026-09-08']);
    EquipmentServiceRecord::factory()->planned()->create(['performed_on' => '2026-10-02']);
    $checklist = EquipmentChecklist::factory()->create(['performed_on' => '2026-09-14']);
    ServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-18']);

    $this->actingAs(User::factory()->create())
        ->get(route('equipment-schedule.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-schedule/index')
            ->where('month', '2026-09')
            ->where('entries', fn ($entries) => collect($entries)->pluck('id')->all() === [$done->id, $planned->id, $checklist->id])
            ->where('entries.1.status', 'overdue')
            ->where('entries.1.can_remove', true)
            ->where('entries.0.status', 'done')
            ->where('entries.0.can_move', false)
            ->where('entries.2.kind', 'checklist')
            ->where('stats.jobs', 2)
            ->where('stats.jobs_done', 1)
            ->where('stats.behind', 1)
            ->where('stats.checklists', 1)
        );
});

test('the vehicle schedule leaves equipment maintenance out', function () {
    EquipmentServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-18']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index'))
        ->assertInertia(fn ($page) => $page->where('stats.jobs', 0));
});

test('maintenance can be put on the equipment schedule', function () {
    $user = User::factory()->create();
    $equipment = Equipment::factory()->create();

    $this->actingAs($user)
        ->post(route('equipment-schedule.jobs.store'), [
            'equipment_id' => $equipment->id,
            'title' => 'Replace compressor air filter',
            'type' => 'maintenance',
            'performed_on' => '2026-09-21',
        ])
        ->assertRedirect();

    $job = EquipmentServiceRecord::sole();
    expect($job->user_id)->toBe($user->id)
        ->and($job->equipment_id)->toBe($equipment->id)
        ->and($job->status)->toBe(ServiceStatus::Planned)
        ->and($job->performed_on->toDateString())->toBe('2026-09-21');
});

test('maintenance needs a piece of equipment, a title, a type and a day', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('equipment-schedule.jobs.store'), ['equipment_id' => 'missing', 'type' => 'brakes'])
        ->assertSessionHasErrors(['equipment_id', 'title', 'type', 'days']);

    expect(EquipmentServiceRecord::count())->toBe(0);
});

test('a scheduler without equipment access cannot put maintenance on the schedule', function () {
    $this->actingAs(User::factory()->scheduler()->create())
        ->post(route('equipment-schedule.jobs.store'), [
            'equipment_id' => Equipment::factory()->create()->id,
            'title' => 'Replace compressor air filter',
            'type' => 'maintenance',
            'performed_on' => '2026-09-21',
        ])
        ->assertForbidden();
});

test('maintenance that is not finished can be moved, but finished maintenance stays put', function () {
    $user = User::factory()->create();
    $started = EquipmentServiceRecord::factory()->inProgress()->create(['performed_on' => '2026-09-16']);
    $finished = EquipmentServiceRecord::factory()->create(['performed_on' => '2026-09-10']);

    $this->actingAs($user)
        ->patch(route('equipment-schedule.jobs.update', $started), ['performed_on' => '2026-09-25'])
        ->assertRedirect();
    $this->actingAs($user)
        ->patch(route('equipment-schedule.jobs.update', $finished), ['performed_on' => '2026-09-25'])
        ->assertSessionHasErrors('performed_on');

    expect($started->fresh()->performed_on->toDateString())->toBe('2026-09-25')
        ->and($finished->fresh()->performed_on->toDateString())->toBe('2026-09-10');
});

test('planned maintenance can be taken off the schedule but maintenance under way cannot', function () {
    $user = User::factory()->create();
    $planned = EquipmentServiceRecord::factory()->planned()->create();
    $started = EquipmentServiceRecord::factory()->inProgress()->create();

    $this->actingAs($user)->delete(route('equipment-schedule.jobs.destroy', $planned))->assertRedirect();
    $this->actingAs($user)->delete(route('equipment-schedule.jobs.destroy', $started))->assertSessionHasErrors('job');

    expect(EquipmentServiceRecord::find($planned->id))->toBeNull()
        ->and(EquipmentServiceRecord::find($started->id))->not->toBeNull();
});

test('maintenance can be booked over several days and shows on each of them', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('equipment-schedule.jobs.store'), [
            'equipment_id' => Equipment::factory()->create()->id,
            'title' => 'Rebuild the hydraulics',
            'type' => 'maintenance',
            'days' => ['2026-09-23', '2026-09-21', '2026-09-22'],
        ])
        ->assertSessionHasNoErrors();

    expect(EquipmentServiceRecord::sole()->days())->toBe(['2026-09-21', '2026-09-22', '2026-09-23']);

    $this->actingAs($user)
        ->get(route('equipment-schedule.index'))
        ->assertInertia(fn ($page) => $page
            ->where('entries', fn ($entries) => collect($entries)->where('kind', 'job')->pluck('date')->all() === ['2026-09-21', '2026-09-22', '2026-09-23'])
            ->where('stats.jobs', 1)
        );
});

test('the days maintenance is booked on can be changed by hand', function () {
    $job = EquipmentServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-21']);

    $this->actingAs(User::factory()->create())
        ->patch(route('equipment-schedule.jobs.update', $job), ['days' => ['2026-09-24', '2026-09-22']])
        ->assertSessionHasNoErrors();

    expect($job->fresh()->days())->toBe(['2026-09-22', '2026-09-24']);
});

test('moving a later day of maintenance over several days moves all of it', function () {
    $job = EquipmentServiceRecord::factory()->planned()->create();
    $job->bookOn(['2026-09-21', '2026-09-22'])->save();

    $this->actingAs(User::factory()->create())
        ->patch(route('equipment-schedule.jobs.update', $job), ['performed_on' => '2026-09-24', 'day' => '2026-09-22'])
        ->assertSessionHasNoErrors();

    expect($job->fresh()->days())->toBe(['2026-09-23', '2026-09-24']);
});
