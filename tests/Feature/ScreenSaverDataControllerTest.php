<?php

use App\Enums\ServiceStatus;
use App\Models\Inspection;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;

beforeEach(function () {
    $this->travelTo('2026-09-15 10:00:00');
});

test('guests cannot see the screen saver data', function () {
    $this->getJson(route('screen-saver.data'))->assertUnauthorized();
});

test('it summarises today\'s open jobs and any checklist still in progress', function () {
    $vehicle = Vehicle::factory()->create(['make' => 'Honda', 'model' => 'Civic']);

    $todayJob = ServiceRecord::factory()->planned()->for($vehicle)->create([
        'title' => 'Front brake pads',
        'performed_on' => '2026-09-15',
    ]);
    ServiceRecord::factory()->create([
        'title' => 'Completed today',
        'status' => ServiceStatus::Completed,
        'performed_on' => '2026-09-15',
    ]);
    ServiceRecord::factory()->planned()->create([
        'title' => 'Tomorrow job',
        'performed_on' => '2026-09-16',
    ]);

    $openChecklist = Inspection::factory()->for($vehicle)->withItems()->create([
        'performed_on' => '2026-09-10',
    ]);
    Inspection::factory()->completed()->create();

    $response = $this->actingAs(User::factory()->create())
        ->getJson(route('screen-saver.data'))
        ->assertOk();

    $response->assertJson([
        'date' => '2026-09-15',
    ]);

    expect($response->json('jobsToday'))->toHaveCount(1)
        ->and($response->json('jobsToday.0.id'))->toBe($todayJob->id)
        ->and($response->json('jobsToday.0.vehicle'))->toBe($vehicle->display_name);

    expect($response->json('checklistsInProgress'))->toHaveCount(1)
        ->and($response->json('checklistsInProgress.0.id'))->toBe($openChecklist->id)
        ->and($response->json('checklistsInProgress.0.itemsCount'))->toBeGreaterThan(0);
});

test('a job over several days counts as today\'s only on the days it is booked', function () {
    $onToday = ServiceRecord::factory()->planned()->create();
    $onToday->bookOn(['2026-09-14', '2026-09-15'])->save();
    $skipsToday = ServiceRecord::factory()->planned()->create();
    $skipsToday->bookOn(['2026-09-14', '2026-09-16'])->save();

    $response = $this->actingAs(User::factory()->create())
        ->getJson(route('screen-saver.data'))
        ->assertOk();

    expect($response->json('jobsToday'))->toHaveCount(1)
        ->and($response->json('jobsToday.0.id'))->toBe($onToday->id);
});

test('a shopper gets no jobs or checklists, just the date', function () {
    ServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-15']);
    Inspection::factory()->withItems()->create(['performed_on' => '2026-09-10']);

    $response = $this->actingAs(User::factory()->shopper()->create())
        ->getJson(route('screen-saver.data'))
        ->assertOk();

    expect($response->json('jobsToday'))->toBe([])
        ->and($response->json('checklistsInProgress'))->toBe([]);
});
