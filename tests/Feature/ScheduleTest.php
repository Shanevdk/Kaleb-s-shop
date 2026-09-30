<?php

use App\Enums\ChecklistTemplate;
use App\Enums\ServiceStatus;
use App\Models\ClosedDay;
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

test('opening the schedule books every vehicle in on an open day from today on', function () {
    Vehicle::factory()->count(4)->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'))->assertOk();

    $booked = PlannedInspection::all();
    $holidays = array_keys(ClosedDay::ontarioHolidays(2026));

    expect($booked->where('template', ChecklistTemplate::AnnualInspection))->toHaveCount(4)
        ->and($booked->every(fn (PlannedInspection $planned): bool => $planned->due_on->greaterThanOrEqualTo(today())))->toBeTrue()
        ->and($booked->every(fn (PlannedInspection $planned): bool => $planned->due_on->isWeekday()))->toBeTrue()
        ->and($booked->every(fn (PlannedInspection $planned): bool => ! in_array($planned->due_on->toDateString(), $holidays, true)))->toBeTrue()
        ->and($booked->pluck('due_on')->map->toDateString()->unique()->count())->toBeGreaterThan(1);

    Vehicle::all()->each(function (Vehicle $vehicle) use ($booked): void {
        $annual = $booked->firstWhere(fn (PlannedInspection $planned): bool => $planned->vehicle_id === $vehicle->id
            && $planned->template === ChecklistTemplate::AnnualInspection);
        $september = $booked->firstWhere(fn (PlannedInspection $planned): bool => $planned->vehicle_id === $vehicle->id
            && $planned->period === '2026-09');

        // The annual inspection covers the monthly check in its month.
        expect($annual->period)->toBe('2026')
            ->and($september?->template)->toBe($annual->due_on->month === 9 ? null : ChecklistTemplate::MonthlyCheck);
    });
});

test('the months after the one on screen are booked in ahead', function () {
    $vehicle = Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'));

    $months = PlannedInspection::where('vehicle_id', $vehicle->id)
        ->get()
        ->map(fn (PlannedInspection $planned): string => $planned->due_on->format('Y-m'))
        ->unique()
        ->sort()
        ->values()
        ->all();

    expect($months)->toBe(['2026-09', '2026-10', '2026-11']);
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
    $bookings = PlannedInspection::count();
    $moved = PlannedInspection::where('period', '2026-09')->where('template', ChecklistTemplate::MonthlyCheck)->firstOrFail();
    $moved->update(['due_on' => '2026-09-29']);

    $this->actingAs($user)->get(route('schedule.index'));

    expect(PlannedInspection::count())->toBe($bookings)
        ->and($moved->fresh()->due_on->toDateString())->toBe('2026-09-29');
});

test('a month that is already over is not booked', function () {
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index', ['month' => '2026-08']))
        ->assertInertia(fn ($page) => $page->where('month', '2026-08')->has('entries', 0));

    expect(PlannedInspection::where('due_on', '<', '2026-09-01')->count())->toBe(0);
});

test('checks are never booked on a Sunday or an Ontario holiday, and weekdays fill before Saturdays', function () {
    // Friday before the Thanksgiving long weekend: Sat 10, Sun 11, Mon 12 (Thanksgiving).
    $this->travelTo('2026-10-09 09:00:00');
    Vehicle::factory()->count(8)->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'));

    $days = PlannedInspection::where('due_on', '<=', '2026-10-31')->pluck('due_on')->map->toDateString();

    expect($days)->not->toContain('2026-10-11')
        ->and($days)->not->toContain('2026-10-12')
        ->and($days)->not->toContain('2026-10-10')
        ->and($days)->toContain('2026-10-13');
});

test('checks booked at the weekend move to the next open day', function () {
    $this->travelTo('2026-09-26 09:00:00');
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->actingAs(User::factory()->scheduler()->create())->get(route('schedule.index'));

    expect(PlannedInspection::where('template', ChecklistTemplate::AnnualInspection)->sole()->due_on->toDateString())->toBe('2026-09-28');
});

test('the Ontario statutory holidays are worked out for the year', function () {
    expect(ClosedDay::ontarioHolidays(2026))->toBe([
        '2026-01-01' => "New Year's Day",
        '2026-02-16' => 'Family Day',
        '2026-04-03' => 'Good Friday',
        '2026-05-18' => 'Victoria Day',
        '2026-07-01' => 'Canada Day',
        '2026-09-07' => 'Labour Day',
        '2026-10-12' => 'Thanksgiving',
        '2026-12-25' => 'Christmas Day',
        '2026-12-26' => 'Boxing Day',
        '2026-12-28' => 'Boxing Day (observed)',
    ]);
});

test('a Christmas and Boxing Day weekend gives the Monday and Tuesday off', function () {
    $holidays = ClosedDay::ontarioHolidays(2027);

    expect($holidays['2027-12-27'])->toBe('Christmas Day (observed)')
        ->and($holidays['2027-12-28'])->toBe('Boxing Day (observed)')
        ->and($holidays['2027-03-26'])->toBe('Good Friday')
        ->and($holidays['2027-05-24'])->toBe('Victoria Day');
});

test('the calendar shows the days the shop is closed', function () {
    ClosedDay::factory()->create(['date' => '2026-09-18', 'reason' => 'Stocktake']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->get(route('schedule.index'))
        ->assertInertia(fn ($page) => $page
            ->where('closedDays.0', ['date' => '2026-09-07', 'reason' => 'Labour Day', 'id' => null])
            ->where('closedDays.1.date', '2026-09-18')
            ->where('closedDays.1.reason', 'Stocktake')
        );
});

test('marking a day closed moves the checks the planner put there but not ones put there by hand', function () {
    $scheduler = User::factory()->scheduler()->create();
    $planned = PlannedInspection::factory()->create(['due_on' => '2026-09-22', 'period' => '2026-09']);
    $pinned = PlannedInspection::factory()->create(['due_on' => '2026-09-22', 'period' => '2026-09', 'pinned' => true]);

    foreach ([$planned, $pinned] as $monthly) {
        PlannedInspection::factory()->annual()->create(['vehicle_id' => $monthly->vehicle_id, 'due_on' => '2026-11-10', 'period' => '2026']);
    }

    $this->actingAs($scheduler)
        ->post(route('schedule.closed-days.store'), ['date' => '2026-09-22', 'reason' => 'Staff training'])
        ->assertRedirect();

    $closed = ClosedDay::sole();
    $movedTo = $planned->fresh()->due_on;

    expect($closed->user_id)->toBe($scheduler->id)
        ->and($closed->reason)->toBe('Staff training')
        ->and($movedTo->toDateString())->not->toBe('2026-09-22')
        ->and($movedTo->isSunday())->toBeFalse()
        ->and($movedTo->month)->toBe(9)
        ->and($pinned->fresh()->due_on->toDateString())->toBe('2026-09-22');
});

test('a day the shop is already closed cannot be marked again', function (string $day) {
    ClosedDay::factory()->create(['date' => '2026-09-22']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->post(route('schedule.closed-days.store'), ['date' => $day, 'reason' => 'Shop closed'])
        ->assertSessionHasErrors('date');

    expect(ClosedDay::count())->toBe(1);
})->with([
    'a Sunday' => '2026-09-20',
    'a holiday' => '2026-10-12',
    'already marked' => '2026-09-22',
]);

test('a marked day can be opened again', function () {
    $closed = ClosedDay::factory()->create(['date' => '2026-09-22']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->delete(route('schedule.closed-days.destroy', $closed))
        ->assertRedirect();

    expect(ClosedDay::count())->toBe(0);
});

test('a shopper cannot close the shop', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->post(route('schedule.closed-days.store'), ['date' => '2026-09-22', 'reason' => 'Shop closed'])
        ->assertForbidden();
});

test('a check moved by hand can go on a closed day and stays there', function () {
    $planned = PlannedInspection::factory()->create(['due_on' => '2026-09-16', 'period' => '2026-09']);

    $this->actingAs(User::factory()->scheduler()->create())
        ->patch(route('schedule.checks.update', $planned), ['due_on' => '2026-09-20'])
        ->assertRedirect();

    expect($planned->fresh()->due_on->toDateString())->toBe('2026-09-20')
        ->and($planned->fresh()->pinned)->toBeTrue();
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

test('the daily command books a check into every month of the coming year', function () {
    Vehicle::factory()->create(['created_at' => '2026-01-10']);

    $this->artisan('inspections:plan')->assertSuccessful();

    $months = PlannedInspection::all()
        ->map(fn (PlannedInspection $planned): string => $planned->due_on->format('Y-m'))
        ->sort()
        ->values()
        ->all();

    // One check a month; in each year one of them is the annual inspection.
    expect($months)->toHaveCount(12)
        ->and($months[0])->toBe('2026-09')
        ->and($months[11])->toBe('2027-08')
        ->and(array_unique($months))->toHaveCount(12)
        ->and(PlannedInspection::where('template', ChecklistTemplate::AnnualInspection)->pluck('period')->sort()->values()->all())->toBe(['2026', '2027']);
});
