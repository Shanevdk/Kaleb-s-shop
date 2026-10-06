<?php

use App\Enums\EquipmentServiceType;
use App\Enums\ServiceStatus;
use App\Models\Equipment;
use App\Models\EquipmentServiceRecord;
use App\Models\ServiceRecord;
use App\Models\User;

beforeEach(function () {
    $this->travelTo('2026-09-15 10:00:00');
});

test('each equipment division has its own job queue, apart from the vehicle jobs', function () {
    $user = User::factory()->create();
    $mainJob = EquipmentServiceRecord::factory()->planned()->for(Equipment::factory())->create(['title' => 'Grease the loader']);
    $usaJob = EquipmentServiceRecord::factory()->planned()->for(Equipment::factory()->usa())->create(['title' => 'Fix the lift']);
    EquipmentServiceRecord::factory()->for(Equipment::factory())->create(['performed_on' => '2026-06-01']);
    ServiceRecord::factory()->planned()->create(['title' => 'Front brake pads']);

    $this->actingAs($user)
        ->get(route('equipment-job-queue.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('equipment-job-queue/index')
            ->where('division', 'main')
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('id')->all() === [$mainJob->id])
        );

    $this->actingAs($user)
        ->get(route('usa.equipment-job-queue.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('division', 'usa')
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('id')->all() === [$usaJob->id])
        );

    $this->actingAs($user)
        ->get(route('job-queue.index'))
        ->assertInertia(fn ($page) => $page
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('title')->all() === ['Front brake pads'])
        );
});

test('an account without a division\'s permission cannot add to its job queue', function () {
    $lift = Equipment::factory()->usa()->create();

    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->post(route('usa.equipment-job-queue.store'), [
            'equipment_id' => $lift->id,
            'title' => 'Fix the lift',
        ])
        ->assertForbidden();

    expect(EquipmentServiceRecord::count())->toBe(0);
});

test('the board only shows work not started yet once it is coming up soon', function () {
    $soon = EquipmentServiceRecord::factory()->planned()->for(Equipment::factory())->create(['performed_on' => '2026-09-29']);
    EquipmentServiceRecord::factory()->planned()->for(Equipment::factory())->create(['performed_on' => '2026-11-20']);
    $underWay = EquipmentServiceRecord::factory()->inProgress()->for(Equipment::factory())->create(['performed_on' => '2026-12-01']);

    $this->actingAs(User::factory()->create())
        ->get(route('equipment-job-queue.index'))
        ->assertInertia(fn ($page) => $page
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('id')->sort()->values()->all() === collect([$soon->id, $underWay->id])->sort()->values()->all())
        );
});

test('a finished job over several days stays on the board for a fortnight after its last day', function () {
    $job = EquipmentServiceRecord::factory()->for(Equipment::factory())->create(['status' => ServiceStatus::Completed]);
    $job->bookOn(['2026-08-25', '2026-09-05'])->save();

    $this->actingAs(User::factory()->create())
        ->get(route('equipment-job-queue.index'))
        ->assertInertia(fn ($page) => $page->where('jobs.0.id', $job->id));
});

test('a job booked for later and finished from the board is finished today', function () {
    $job = EquipmentServiceRecord::factory()->planned()->for(Equipment::factory())->create();
    $job->bookOn(['2026-11-20', '2026-11-21'])->save();

    $this->actingAs(User::factory()->create())
        ->patch(route('equipment-job-queue.update', $job), ['status' => 'completed'])
        ->assertRedirect();

    expect($job->fresh()->days())->toBe(['2026-09-15']);
});

test('a job over several days finished part way through keeps only the days worked', function () {
    $job = EquipmentServiceRecord::factory()->inProgress()->for(Equipment::factory())->create();
    $job->bookOn(['2026-09-14', '2026-09-15', '2026-09-16'])->save();

    $this->actingAs(User::factory()->create())
        ->patch(route('equipment-job-queue.update', $job), ['status' => 'completed'])
        ->assertRedirect();

    expect($job->fresh()->days())->toBe(['2026-09-14', '2026-09-15']);
});

test('a job can be quick added to a division\'s queue for one of its machines', function () {
    $loader = Equipment::factory()->create();

    $this->actingAs(User::factory()->create())
        ->post(route('equipment-job-queue.store'), [
            'equipment_id' => $loader->id,
            'title' => 'Grease the loader',
        ])
        ->assertSessionHasNoErrors();

    $job = EquipmentServiceRecord::sole();
    expect($job->equipment_id)->toBe($loader->id)
        ->and($job->status)->toBe(ServiceStatus::Planned)
        ->and($job->type)->toBe(EquipmentServiceType::Other)
        ->and($job->performed_on->toDateString())->toBe('2026-09-15');
});

test('a job cannot be quick added for the other division\'s machine', function () {
    $lift = Equipment::factory()->usa()->create();

    $this->actingAs(User::factory()->create())
        ->post(route('equipment-job-queue.store'), [
            'equipment_id' => $lift->id,
            'title' => 'Fix the lift',
        ])
        ->assertSessionHasErrors('equipment_id');

    expect(EquipmentServiceRecord::count())->toBe(0);
});

test('a job can be moved along the board, but only by someone with its division', function () {
    $job = EquipmentServiceRecord::factory()->planned()->for(Equipment::factory()->usa())->create();

    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment']]))
        ->patch(route('equipment-job-queue.update', $job), ['status' => 'in_progress'])
        ->assertForbidden();

    expect($job->fresh()->status)->toBe(ServiceStatus::Planned);

    $this->actingAs(User::factory()->shopper()->create(['permissions' => ['equipment-usa']]))
        ->patch(route('equipment-job-queue.update', $job), ['status' => 'in_progress'])
        ->assertRedirect();

    expect($job->fresh()->status)->toBe(ServiceStatus::InProgress);
});
