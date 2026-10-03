<?php

use App\Actions\SyncServiceRecordStock;
use App\Enums\ServiceStatus;
use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;

beforeEach(function () {
    $this->travelTo('2026-09-15 10:00:00');
});

test('guests cannot see the job queue', function () {
    $this->get(route('job-queue.index'))->assertRedirect(route('login'));
});

test('a shopper cannot see the job queue', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('job-queue.index'))
        ->assertForbidden();
});

test('the job queue shows jobs not yet done, and what was finished recently', function () {
    $user = User::factory()->create();
    $planned = ServiceRecord::factory()->for($user)->planned()->create();
    $inProgress = ServiceRecord::factory()->for($user)->inProgress()->create();
    $recentlyDone = ServiceRecord::factory()->for($user)->create(['performed_on' => '2026-09-10']);
    $longDone = ServiceRecord::factory()->for($user)->create(['performed_on' => '2026-06-01']);

    $this->actingAs($user)
        ->get(route('job-queue.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('job-queue/index')
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('id')->sort()->values()->all() === collect([
                $planned->id, $inProgress->id, $recentlyDone->id,
            ])->sort()->values()->all())
        );

    expect($longDone)->not->toBeNull();
});

test('a mechanic can quick add a job straight to the queue with just a vehicle and a title', function () {
    $vehicle = Vehicle::factory()->create();

    $this->actingAs(User::factory()->create())
        ->post(route('job-queue.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Front brake pads',
        ])
        ->assertRedirect();

    $job = ServiceRecord::query()->where('title', 'Front brake pads')->firstOrFail();

    expect($job->vehicle_id)->toBe($vehicle->id)
        ->and($job->status)->toBe(ServiceStatus::Planned)
        ->and($job->performed_on->toDateString())->toBe('2026-09-15')
        ->and($job->type->value)->toBe('other');
});

test('quick adding a job requires a vehicle and a title', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('job-queue.store'), [])
        ->assertSessionHasErrors(['vehicle_id', 'title']);

    expect(ServiceRecord::query()->count())->toBe(0);
});

test('a shopper cannot quick add a job', function () {
    $vehicle = Vehicle::factory()->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->post(route('job-queue.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Front brake pads',
        ])
        ->assertForbidden();

    expect(ServiceRecord::query()->count())->toBe(0);
});

test('the queue shows what a job still needs off the shelf, and the shortfall if the shelf comes up short', function () {
    $user = User::factory()->create();
    $covered = ServiceRecord::factory()->for($user)->planned()->create();
    $short = ServiceRecord::factory()->for($user)->planned()->create();
    $stocked = InventoryItem::factory()->for($user)->create(['quantity' => 10]);
    $scarce = InventoryItem::factory()->for($user)->create(['quantity' => 1]);

    ServiceRecordPart::factory()->for($covered)->create([
        'inventory_item_id' => $stocked->id,
        'name' => $stocked->name,
        'quantity' => 4,
        'unit' => UnitOfMeasure::Each,
    ]);
    ServiceRecordPart::factory()->for($short)->create([
        'inventory_item_id' => $scarce->id,
        'name' => $scarce->name,
        'quantity' => 4,
        'unit' => UnitOfMeasure::Each,
    ]);

    $this->actingAs($user)
        ->get(route('job-queue.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('jobs', function ($jobs) use ($covered, $short) {
                $jobs = collect($jobs)->keyBy('id');

                return (float) $jobs[$covered->id]['parts'][0]['shortfall'] === 0.0
                    && (float) $jobs[$short->id]['parts'][0]['shortfall'] === 3.0;
            })
        );
});

test('a mechanic can move a job from one column to another', function () {
    $user = User::factory()->create();
    $job = ServiceRecord::factory()->for($user)->planned()->create();

    $this->actingAs($user)
        ->patch(route('job-queue.update', $job), ['status' => 'in_progress'])
        ->assertRedirect();

    expect($job->fresh()->status)->toBe(ServiceStatus::InProgress);
});

test('moving a job to complete takes its parts off the shelf', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);
    $job = ServiceRecord::factory()->for($user)->for($vehicle)->inProgress()->create();
    ServiceRecordPart::factory()->for($job)->create([
        'inventory_item_id' => $item->id,
        'name' => $item->name,
        'quantity' => 4,
        'unit' => 'each',
    ]);

    $this->actingAs($user)
        ->patch(route('job-queue.update', $job), ['status' => 'completed'])
        ->assertRedirect();

    expect($job->fresh()->status)->toBe(ServiceStatus::Completed)
        ->and($item->refresh()->quantity)->toEqual(6.0);
});

test('dragging a completed job back puts its parts back on the shelf', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 10]);
    $job = ServiceRecord::factory()->for($user)->for($vehicle)->create();
    ServiceRecordPart::factory()->for($job)->create([
        'inventory_item_id' => $item->id,
        'name' => $item->name,
        'quantity' => 4,
        'unit' => 'each',
        'quantity_taken' => 4,
    ]);
    $item->update(['quantity' => 6]);

    $this->actingAs($user)
        ->patch(route('job-queue.update', $job), ['status' => 'in_progress'])
        ->assertRedirect();

    expect($item->refresh()->quantity)->toEqual(10.0);
});

test('a job logged by someone since removed can still be completed, and the stock is put down to whoever moved it', function () {
    $author = User::factory()->create();
    $mechanic = User::factory()->create();
    $vehicle = Vehicle::factory()->create();
    $item = InventoryItem::factory()->create(['quantity' => 10]);
    $job = ServiceRecord::factory()->for($author)->for($vehicle)->inProgress()->create();
    ServiceRecordPart::factory()->for($job)->create([
        'inventory_item_id' => $item->id,
        'name' => $item->name,
        'quantity' => 4,
        'unit' => 'each',
    ]);

    $author->delete();

    expect($job->fresh()->user_id)->toBeNull();

    $this->actingAs($mechanic)
        ->patch(route('job-queue.update', $job), ['status' => 'completed'])
        ->assertRedirect();

    expect($job->fresh()->status)->toBe(ServiceStatus::Completed)
        ->and($item->refresh()->quantity)->toEqual(6.0)
        ->and(StockMovement::sole()->user_id)->toBe($mechanic->id);
});

test('a job stays where it was when taking its stock fails', function () {
    $user = User::factory()->create();
    $job = ServiceRecord::factory()->for($user)->inProgress()->create();

    $this->mock(SyncServiceRecordStock::class)
        ->shouldReceive('handle')
        ->andThrow(new RuntimeException('The shelf could not be updated.'));

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($user)->patch(route('job-queue.update', $job), ['status' => 'completed']))
        ->toThrow(RuntimeException::class);

    expect($job->fresh()->status)->toBe(ServiceStatus::InProgress);
});

test('a job cannot be moved to a made up status', function () {
    $user = User::factory()->create();
    $job = ServiceRecord::factory()->for($user)->planned()->create();

    $this->actingAs($user)
        ->patch(route('job-queue.update', $job), ['status' => 'done'])
        ->assertSessionHasErrors('status');

    expect($job->fresh()->status)->toBe(ServiceStatus::Planned);
});

test('a shopper cannot move a job on the queue', function () {
    $job = ServiceRecord::factory()->planned()->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->patch(route('job-queue.update', $job), ['status' => 'in_progress'])
        ->assertForbidden();
});
