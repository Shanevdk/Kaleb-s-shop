<?php

use App\Enums\ChecklistTemplate;
use App\Enums\ServiceStatus;
use App\Models\Inspection;
use App\Models\PlannedInspection;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;

beforeEach(function () {
    // A Tuesday.
    $this->travelTo('2026-09-15 10:00:00');
});

test('guests cannot see the schedule', function () {
    $this->get(route('schedule.index'))->assertRedirect(route('login'));
});

test('schedulers, mechanics and admins can see the schedule', function (string $role) {
    $this->actingAs(User::factory()->create(['role' => $role]))
        ->get(route('schedule.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('schedule/index')->where('month', '2026-09'));
})->with(['scheduler', 'mechanic', 'admin']);

test('a scheduler lands on the schedule and cannot open the records', function () {
    $scheduler = User::factory()->scheduler()->create();

    $this->actingAs($scheduler)->get(route('dashboard'))->assertRedirect(route('schedule.index'));
    $this->actingAs($scheduler)->get(route('vehicles.index'))->assertForbidden();
    $this->actingAs($scheduler)->get(route('service-records.index'))->assertForbidden();
    $this->actingAs($scheduler)->get(route('inspections.index'))->assertForbidden();
});

test('opening the schedule books every vehicle in on a weekday from today on', function () {
    Vehicle::factory()->count(4)->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'))->assertOk();

    $booked = PlannedInspection::all();

    expect($booked->where('template', ChecklistTemplate::AnnualInspection))->toHaveCount(4)
        ->and($booked->every(fn (PlannedInspection $planned): bool => $planned->due_on->greaterThanOrEqualTo(today())))->toBeTrue()
        ->and($booked->every(fn (PlannedInspection $planned): bool => $planned->due_on->isWeekday()))->toBeTrue()
        ->and($booked->pluck('due_on')->map->toDateString()->unique()->count())->toBeGreaterThan(1);

    Vehicle::all()->each(function (Vehicle $vehicle) use ($booked): void {
        $annual = $booked->firstWhere(fn (PlannedInspection $planned): bool => $planned->vehicle_id === $vehicle->id
            && $planned->template === ChecklistTemplate::AnnualInspection);
        $monthly = $booked->firstWhere(fn (PlannedInspection $planned): bool => $planned->vehicle_id === $vehicle->id
            && $planned->template === ChecklistTemplate::MonthlyCheck);

        // The annual inspection covers the monthly check in its month.
        expect($annual->period)->toBe('2026')
            ->and($annual->due_on->month === 9 ? $monthly : $monthly?->period)->toBe($annual->due_on->month === 9 ? null : '2026-09');
    });
});

test('annual inspections are spread across the months left in the year', function () {
    Vehicle::factory()->count(4)->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'));

    $months = PlannedInspection::where('template', ChecklistTemplate::AnnualInspection)
        ->get()
        ->map(fn (PlannedInspection $planned): int => $planned->due_on->month)
        ->sort()
        ->values()
        ->all();

    expect($months)->toBe([9, 10, 11, 12]);
});

test('opening the schedule again books nothing new and leaves moved checks alone', function () {
    Vehicle::factory()->count(2)->create(['created_at' => '2026-01-10']);
    $user = User::factory()->scheduler()->create();

    $this->actingAs($user)->get(route('schedule.index'));
    $moved = PlannedInspection::where('template', ChecklistTemplate::MonthlyCheck)->firstOrFail();
    $moved->update(['due_on' => '2026-09-29']);

    $this->actingAs($user)->get(route('schedule.index'));

    expect(PlannedInspection::count())->toBe(3)
        ->and($moved->fresh()->due_on->toDateString())->toBe('2026-09-29');
});

test('a month that is already over is not booked', function () {
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index', ['month' => '2026-08']))
        ->assertInertia(fn ($page) => $page->where('month', '2026-08')->has('entries', 0));

    expect(PlannedInspection::count())->toBe(0);
});

test('checks booked at the weekend move to the next weekday', function () {
    $this->travelTo('2026-09-26 09:00:00');
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'));

    expect(PlannedInspection::sole()->due_on->toDateString())->toBe('2026-09-28');
});

test('a check shows as done on the day it was done, and one past its day as overdue', function () {
    $done = Vehicle::factory()->create(['created_at' => '2026-01-10']);
    $late = Vehicle::factory()->create(['created_at' => '2026-01-10']);
    PlannedInspection::factory()->annual()->for($done)->create(['due_on' => '2026-11-02', 'period' => '2026']);
    PlannedInspection::factory()->annual()->for($late)->create(['due_on' => '2026-11-03', 'period' => '2026']);
    PlannedInspection::factory()->for($done)->create(['due_on' => '2026-09-22', 'period' => '2026-09']);
    PlannedInspection::factory()->for($late)->create(['due_on' => '2026-09-10', 'period' => '2026-09']);
    $inspection = Inspection::factory()->for($done)->completed()->create([
        'template' => ChecklistTemplate::MonthlyCheck,
        'performed_on' => '2026-09-08',
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('schedule.index'))
        ->assertInertia(fn ($page) => $page
            ->has('entries', 2)
            ->where('entries.0.date', '2026-09-08')
            ->where('entries.0.status', 'done')
            ->where('entries.0.inspection_id', $inspection->id)
            ->where('entries.0.can_move', false)
            ->where('entries.1.date', '2026-09-10')
            ->where('entries.1.status', 'overdue')
            ->where('entries.1.can_move', true)
            ->where('stats.checks', 2)
            ->where('stats.checks_done', 1)
            ->where('stats.behind', 1)
        );
});

test('jobs for the month are on the calendar', function () {
    $job = ServiceRecord::factory()->planned()->create(['performed_on' => '2026-09-18', 'title' => 'Replace clutch']);
    ServiceRecord::factory()->planned()->create(['performed_on' => '2026-10-02']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index'))
        ->assertInertia(fn ($page) => $page
            ->where('entries', fn ($entries) => collect($entries)->where('kind', 'job')->pluck('id')->all() === [$job->id])
            ->where('stats.jobs', 1)
        );
});

test('a scheduler can put a job on the schedule', function () {
    $scheduler = User::factory()->scheduler()->create();
    $vehicle = Vehicle::factory()->create();

    $this->actingAs($scheduler)
        ->post(route('schedule.jobs.store'), [
            'vehicle_id' => $vehicle->id,
            'title' => 'Replace front brake pads',
            'type' => 'brakes',
            'performed_on' => '2026-09-21',
            'description' => 'Customer says they squeal.',
        ])
        ->assertRedirect();

    $job = ServiceRecord::sole();
    expect($job->user_id)->toBe($scheduler->id)
        ->and($job->vehicle_id)->toBe($vehicle->id)
        ->and($job->status)->toBe(ServiceStatus::Planned)
        ->and($job->performed_on->toDateString())->toBe('2026-09-21');
});

test('a job needs a vehicle, a title, a type and a day', function () {
    $this->actingAs(User::factory()->scheduler()->create())
        ->post(route('schedule.jobs.store'), ['type' => 'made_up'])
        ->assertSessionHasErrors(['vehicle_id', 'title', 'type', 'performed_on']);

    expect(ServiceRecord::count())->toBe(0);
});

test('a shopper cannot put anything on the schedule', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->post(route('schedule.jobs.store'), [
            'vehicle_id' => Vehicle::factory()->create()->id,
            'title' => 'Replace front brake pads',
            'type' => 'brakes',
            'performed_on' => '2026-09-21',
        ])
        ->assertForbidden();
});

test('a check can be moved to another day in its month', function () {
    $planned = PlannedInspection::factory()->create(['due_on' => '2026-09-16', 'period' => '2026-09']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.checks.update', $planned), ['due_on' => '2026-09-24'])
        ->assertRedirect();

    expect($planned->fresh()->due_on->toDateString())->toBe('2026-09-24');
});

test('a check cannot be moved out of its month or into the past', function (string $day) {
    $planned = PlannedInspection::factory()->create(['due_on' => '2026-09-16', 'period' => '2026-09']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.checks.update', $planned), ['due_on' => $day])
        ->assertSessionHasErrors('due_on');

    expect($planned->fresh()->due_on->toDateString())->toBe('2026-09-16');
})->with(['2026-10-01', '2026-09-14']);

test('moving the annual inspection to another month hands the monthly check back', function () {
    $vehicle = Vehicle::factory()->create(['created_at' => '2026-01-10']);
    $annual = PlannedInspection::factory()->annual()->for($vehicle)->create(['due_on' => '2026-09-17', 'period' => '2026']);
    PlannedInspection::factory()->for($vehicle)->create(['due_on' => '2026-10-05', 'period' => '2026-10']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.checks.update', $annual), ['due_on' => '2026-10-14'])
        ->assertRedirect();

    $monthly = PlannedInspection::where('template', ChecklistTemplate::MonthlyCheck)->pluck('period')->all();

    expect($monthly)->toBe(['2026-09']);
});

test('a job that is not finished can be moved', function () {
    $job = ServiceRecord::factory()->inProgress()->create(['performed_on' => '2026-09-16']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.jobs.update', $job), ['performed_on' => '2026-09-25'])
        ->assertRedirect();

    expect($job->fresh()->performed_on->toDateString())->toBe('2026-09-25');
});

test('a finished job stays on the day it was done', function () {
    $job = ServiceRecord::factory()->create(['performed_on' => '2026-09-10']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.jobs.update', $job), ['performed_on' => '2026-09-25'])
        ->assertSessionHasErrors('performed_on');

    expect($job->fresh()->performed_on->toDateString())->toBe('2026-09-10');
});

test('a planned job can be taken off the schedule but one under way cannot', function () {
    $scheduler = User::factory()->scheduler()->create();
    $planned = ServiceRecord::factory()->planned()->create();
    $started = ServiceRecord::factory()->inProgress()->create();

    $this->actingAs($scheduler)->delete(route('schedule.jobs.destroy', $planned))->assertRedirect();
    $this->actingAs($scheduler)->delete(route('schedule.jobs.destroy', $started))->assertSessionHasErrors('job');

    expect(ServiceRecord::find($planned->id))->toBeNull()
        ->and(ServiceRecord::find($started->id))->not->toBeNull();
});

test('the daily command books this month and next', function () {
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->artisan('inspections:plan')->assertSuccessful();

    expect(PlannedInspection::where('template', ChecklistTemplate::AnnualInspection)->count())->toBe(1)
        ->and(PlannedInspection::where('template', ChecklistTemplate::MonthlyCheck)->count())->toBe(1);
});
