<?php

use App\Enums\EstimateStatus;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Jobs\EstimateServiceRecordDuration;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

/**
 * A chat completion carrying an estimate of the given hours.
 *
 * @return array<string, mixed>
 */
function hoursReply(float $hours, ?string $content = null): array
{
    return [
        'model' => 'first/model:free',
        'choices' => [['finish_reason' => 'stop', 'message' => ['role' => 'assistant', 'content' => $content ?? json_encode([
            'hours' => $hours,
            'range' => ['low' => $hours - 0.5, 'high' => $hours + 1],
            'reasoning' => 'Wheels off, pads and rotors, bleed and test drive.',
        ])]]],
    ];
}

/**
 * Run the queued estimate for a job right here.
 */
function runEstimate(ServiceRecord $record, ?string $fingerprint = null): void
{
    app()->call([new EstimateServiceRecordDuration($record, $fingerprint ?? $record->estimateFingerprint()), 'handle']);
}

beforeEach(function () {
    config([
        'services.openrouter.key' => 'test-key',
        'services.openrouter.model' => 'first/model:free',
        'services.openrouter.fallback_models' => [],
    ]);
    Http::preventStrayRequests();
});

test('saving a new job queues its time estimate without waiting for it', function () {
    Queue::fake();
    $vehicle = Vehicle::factory()->create();

    $this->actingAs(User::factory()->create())->post(route('service-records.store'), [
        'vehicle_id' => $vehicle->id,
        'title' => 'Front brake pads and rotors',
        'type' => ServiceType::Brakes->value,
        'status' => ServiceStatus::Planned->value,
        'performed_on' => '2026-10-01',
        'description' => 'Pedal is soft.',
    ])->assertRedirect(route('service-records.index'));

    $record = ServiceRecord::sole();

    expect($record->estimate_status)->toBe(EstimateStatus::Pending);
    Queue::assertPushed(EstimateServiceRecordDuration::class, fn ($job) => $job->serviceRecord->is($record));
    Http::assertNothingSent();
});

test('changing the notes on a job queues a fresh estimate', function () {
    Queue::fake();
    $record = ServiceRecord::factory()->planned()->create(['description' => 'Pedal is soft.']);
    Queue::fake();

    $record->update(['description' => 'Pedal is soft and the rotors are scored.']);

    Queue::assertPushed(EstimateServiceRecordDuration::class, 1);
});

test('changes that do not alter the work do not queue an estimate', function () {
    Queue::fake();
    $record = ServiceRecord::factory()->planned()->create(['description' => 'Pedal is soft.']);
    Queue::fake();

    $record->update(['odometer' => 150000]);
    $record->update(['description' => "Estimated time: 9 hours\n\nPedal is soft."]);

    Queue::assertNothingPushed();
});

test('finished jobs, and a shop without the AI set up, get no estimate', function () {
    Queue::fake();
    ServiceRecord::factory()->create(['status' => ServiceStatus::Completed]);

    config(['services.openrouter.key' => null]);
    $open = ServiceRecord::factory()->planned()->create();

    Queue::assertNothingPushed();
    expect($open->refresh()->estimate_status)->toBeNull();
});

test('the estimate is stored on the job and shown on its page', function () {
    Queue::fake();
    Http::fake(['openrouter.ai/*' => Http::response(hoursReply(2.5))]);
    $record = ServiceRecord::factory()->planned()->create([
        'title' => 'Front brake pads and rotors',
        'description' => "Estimated time: 9 hours\n\nPedal is soft.",
    ]);

    runEstimate($record);

    expect($record->refresh())
        ->estimate_status->toBe(EstimateStatus::Ready)
        ->estimated_hours->toBe('2.50')
        ->estimated_hours_low->toBe('2.00')
        ->estimated_hours_high->toBe('3.50');

    Http::assertSent(fn (Request $request): bool => str_contains($request['messages'][1]['content'], 'Notes on the job: Pedal is soft.')
        && ! str_contains($request['messages'][1]['content'], 'Estimated time'));

    $this->withoutVite()
        ->actingAs(User::factory()->create())
        ->get(route('service-records.show', $record))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('record.estimate.status', 'ready')
            ->where('record.estimate.hours', 2.5)
            ->where('record.estimate.reasoning', 'Wheels off, pads and rotors, bleed and test drive.')
        );
});

test('an estimate for notes that have since changed is thrown away', function () {
    Queue::fake();
    Http::fake(['openrouter.ai/*' => Http::response(hoursReply(2.5))]);
    $record = ServiceRecord::factory()->planned()->create(['description' => 'Pedal is soft.']);
    $askedFor = $record->estimateFingerprint();

    $record->update(['description' => 'Pedal is soft and the caliper is seized.']);
    runEstimate($record, $askedFor);

    expect($record->refresh())
        ->estimate_status->toBe(EstimateStatus::Pending)
        ->estimated_hours->toBeNull();
    Http::assertNothingSent();
});

test('a failed estimate is marked so the page stops waiting', function () {
    Queue::fake();
    Http::fake(['openrouter.ai/*' => Http::response(hoursReply(0, 'Not sure, sorry.'))]);
    $record = ServiceRecord::factory()->planned()->create();

    runEstimate($record);

    expect($record->refresh()->estimate_status)->toBe(EstimateStatus::Failed);
});

test('the AI prices the parts the shelf has no price for, and leaves shelf prices alone', function () {
    Queue::fake();
    $record = ServiceRecord::factory()->planned()->create(['title' => 'Front brake pads']);
    $cleaner = InventoryItem::factory()->create(['name' => 'Brake cleaner', 'unit_cost' => 30]);
    $record->parts()->create(['inventory_item_id' => $cleaner->id, 'name' => 'Brake cleaner', 'quantity' => 2, 'unit' => 'each']);
    $pads = $record->parts()->create(['name' => 'Front brake pad set', 'quantity' => 1, 'unit' => 'each']);

    // Answer by the numbers the parts were given in the brief, pricing the
    // shelf part too to show that price is ignored.
    Http::fake(['openrouter.ai/*' => function (Request $request) {
        $brief = $request['messages'][1]['content'];
        preg_match('/^(\d+)\. Front brake pad set/m', $brief, $padsLine);
        preg_match('/^(\d+)\. Brake cleaner/m', $brief, $cleanerLine);

        return Http::response(hoursReply(2.5, json_encode([
            'hours' => 2.5,
            'reasoning' => 'Pads and a clean-up.',
            'part_prices' => [
                ['part' => (int) $padsLine[1], 'price_each' => 89.5],
                ['part' => (int) $cleanerLine[1], 'price_each' => 999],
            ],
        ])));
    }]);

    runEstimate($record);

    expect($pads->refresh()->estimated_unit_cost)->toBe('89.50')
        ->and(ServiceRecordPart::query()->where('name', 'Brake cleaner')->sole()->estimated_unit_cost)->toBeNull();

    Http::assertSent(fn (Request $request): bool => str_contains($request['messages'][1]['content'], 'Brake cleaner × 2, shelf price 30.00 each')
        && str_contains($request['messages'][1]['content'], 'Front brake pad set × 1, no price known'));
});

test('changing the parts on a job queues a fresh estimate so they get priced, and a save that leaves them alone does not', function () {
    Queue::fake();
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->planned()->create(['description' => 'Pedal is soft.']);
    $form = [
        'vehicle_id' => $record->vehicle_id,
        'title' => $record->title,
        'type' => $record->type->value,
        'status' => ServiceStatus::Planned->value,
        'performed_on' => $record->performed_on->toDateString(),
        'description' => 'Pedal is soft.',
    ];
    Queue::fake();

    $this->actingAs($user)->put(route('service-records.update', $record), [
        ...$form,
        'parts' => [['id' => null, 'inventory_item_id' => null, 'name' => 'Front brake pad set', 'quantity' => 1, 'unit' => 'each']],
    ])->assertRedirect();

    Queue::assertPushed(EstimateServiceRecordDuration::class, 1);

    $part = ServiceRecordPart::sole();
    Queue::fake();

    $this->actingAs($user)->put(route('service-records.update', $record), [
        ...$form,
        'parts' => [['id' => $part->id, 'inventory_item_id' => null, 'name' => 'Front brake pad set', 'quantity' => 1, 'unit' => 'each']],
    ])->assertRedirect();

    Queue::assertNothingPushed();
});
