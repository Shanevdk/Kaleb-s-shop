<?php

use App\Enums\CheckStatus;
use App\Enums\RepairPartsStatus;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Jobs\PlanRepairForFlaggedItem;
use App\Models\InspectionItem;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

/**
 * A chat completion whose answer is the given repair plan.
 *
 * @param  array<string, mixed>|string  $plan
 * @return array<string, mixed>
 */
function repairPlanReply(array|string $plan): array
{
    return [
        'model' => 'first/model:free',
        'choices' => [['finish_reason' => 'stop', 'message' => [
            'role' => 'assistant',
            'content' => is_string($plan) ? $plan : json_encode($plan),
        ]]],
    ];
}

beforeEach(function () {
    config([
        'services.openrouter.key' => 'test-key',
        'services.openrouter.model' => 'first/model:free',
        'services.openrouter.fallback_models' => [],
    ]);
    Http::preventStrayRequests();
});

test('flagging an item sets about planning its repair', function () {
    Queue::fake();
    $user = User::factory()->create();
    $item = InspectionItem::factory()->create();

    $this->actingAs($user)
        ->patch(route('inspection-items.update', $item), ['status' => CheckStatus::Attention->value])
        ->assertRedirect();

    expect($item->fresh()->parts_status)->toBe(RepairPartsStatus::Pending);
    Queue::assertPushed(PlanRepairForFlaggedItem::class, fn (PlanRepairForFlaggedItem $job): bool => $job->item->is($item)
        && $job->user->is($user)
        && $job->connection === 'deferred');
});

test('saving a note on an item that was already flagged does not plan it again', function () {
    Queue::fake();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Planned]);

    $this->actingAs(User::factory()->create())
        ->patch(route('inspection-items.update', $item), ['status' => CheckStatus::Attention->value, 'notes' => 'Pads at 2mm'])
        ->assertRedirect();

    Queue::assertNothingPushed();
});

test('the planned repair puts parts that are not on the shelf on the shopping list', function () {
    $user = User::factory()->create();
    $item = InspectionItem::factory()->create([
        'section' => 'Brakes',
        'label' => 'Front pads and discs',
        'status' => CheckStatus::Attention,
        'notes' => 'Pads at 2mm',
    ]);
    $cleaner = InventoryItem::factory()->create(['name' => 'Brake cleaner', 'quantity' => 6]);
    Http::fake(['openrouter.ai/*' => Http::response(repairPlanReply([
        'type' => 'brakes',
        'parts' => [
            ['name' => 'Front brake pad set', 'quantity' => 1, 'unit' => 'set', 'inventory_item_id' => null],
            ['name' => 'whatever the model called it', 'quantity' => 1, 'unit' => 'each', 'inventory_item_id' => $cleaner->id],
        ],
    ]))]);

    PlanRepairForFlaggedItem::dispatchSync($item, $user);

    $job = ServiceRecord::with('parts')->sole();
    expect($item->fresh()->parts_status)->toBe(RepairPartsStatus::Planned)
        ->and($job->inspection_item_id)->toBe($item->id)
        ->and($job->user_id)->toBe($user->id)
        ->and($job->vehicle_id)->toBe($item->inspection->vehicle_id)
        ->and($job->status)->toBe(ServiceStatus::Planned)
        ->and($job->type)->toBe(ServiceType::Brakes)
        ->and($job->title)->toBe('Fix: Front pads and discs')
        ->and($job->description)->toContain('Pads at 2mm')
        ->and($job->parts->pluck('name')->all())->toBe(['Front brake pad set', 'Brake cleaner'])
        ->and($job->parts->last()->inventory_item_id)->toBe($cleaner->id);

    Http::assertSent(fn ($request): bool => str_contains(json_encode($request['messages']), 'Pads at 2mm'));

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertInertia(fn ($page) => $page
            ->has('shortLines', 1)
            ->where('shortLines.0.name', 'Front brake pad set')
            ->where('shortLines.0.jobs.0.id', $job->id)
        );
});

test('a shelf id the model made up is not linked to anything', function () {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention]);
    Http::fake(['openrouter.ai/*' => Http::response(repairPlanReply(
        "Here you go:\n```json\n".json_encode(['type' => 'nonsense', 'parts' => [
            ['name' => 'Wiper blade', 'quantity' => 2, 'unit' => 'furlong', 'inventory_item_id' => '01JMADEUPMADEUPMADEUPMADEU'],
        ]])."\n```",
    ))]);

    PlanRepairForFlaggedItem::dispatchSync($item, User::factory()->create());

    $job = ServiceRecord::with('parts')->sole();
    expect($job->type)->toBe(ServiceType::Other)
        ->and($job->parts->sole()->inventory_item_id)->toBeNull()
        ->and($job->parts->sole()->unit->value)->toBe('each')
        ->and((float) $job->parts->sole()->quantity)->toBe(2.0);
});

test('an item that needs no parts gets no repair job', function () {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention]);
    Http::fake(['openrouter.ai/*' => Http::response(repairPlanReply(['type' => 'tyres', 'parts' => []]))]);

    PlanRepairForFlaggedItem::dispatchSync($item, User::factory()->create());

    expect($item->fresh()->parts_status)->toBe(RepairPartsStatus::NoneNeeded)
        ->and(ServiceRecord::count())->toBe(0);
});

test('the item is marked as failed when the models cannot answer', function (Closure $reply) {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention]);
    Http::fake(['openrouter.ai/*' => $reply()]);

    PlanRepairForFlaggedItem::dispatchSync($item, User::factory()->create());

    expect($item->fresh()->parts_status)->toBe(RepairPartsStatus::Failed)
        ->and(ServiceRecord::count())->toBe(0);
})->with([
    'rate limited' => fn () => fn () => Http::response(['error' => 'busy'], 429),
    'not json' => fn () => fn () => Http::response(repairPlanReply('Sorry, I am not sure.')),
]);

test('an item put right before the plan came back is left alone', function () {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Fixed]);
    Http::fake();

    PlanRepairForFlaggedItem::dispatchSync($item, User::factory()->create());

    Http::assertNothingSent();
    expect(ServiceRecord::count())->toBe(0);
});

test('unflagging an item throws away its repair job if nobody has started it', function () {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Planned]);
    $planned = ServiceRecord::factory()->planned()->create(['inspection_item_id' => $item->id]);

    $this->actingAs(User::factory()->create())
        ->patch(route('inspection-items.update', $item), ['status' => CheckStatus::Good->value])
        ->assertRedirect();

    expect(ServiceRecord::find($planned->id))->toBeNull()
        ->and($item->fresh()->parts_status)->toBeNull();
});

test('unflagging an item keeps a repair job that is already under way', function () {
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Planned]);
    $started = ServiceRecord::factory()->inProgress()->create(['inspection_item_id' => $item->id]);

    $this->actingAs(User::factory()->create())
        ->patch(route('inspection-items.update', $item), ['status' => CheckStatus::Fixed->value])
        ->assertRedirect();

    expect(ServiceRecord::find($started->id))->not->toBeNull();
});

test('the parts can be worked out again for a flagged item', function () {
    Queue::fake();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Failed]);

    $this->actingAs(User::factory()->create())
        ->post(route('inspection-items.replan', $item))
        ->assertRedirect();

    expect($item->fresh()->parts_status)->toBe(RepairPartsStatus::Pending);
    Queue::assertPushed(PlanRepairForFlaggedItem::class);
});

test('an item that is not flagged cannot have parts worked out', function () {
    Queue::fake();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Good]);

    $this->actingAs(User::factory()->create())
        ->post(route('inspection-items.replan', $item))
        ->assertSessionHasErrors('status');

    Queue::assertNothingPushed();
});

test('a shopper cannot flag items or work out parts', function () {
    Queue::fake();
    $shopper = User::factory()->shopper()->create();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention]);

    $this->actingAs($shopper)->post(route('inspection-items.replan', $item))->assertForbidden();

    Queue::assertNothingPushed();
});

test('the checklist shows the parts planned for a flagged item', function () {
    $user = User::factory()->create();
    $item = InspectionItem::factory()->create(['status' => CheckStatus::Attention, 'parts_status' => RepairPartsStatus::Planned]);
    $job = ServiceRecord::factory()->planned()->create(['inspection_item_id' => $item->id]);
    $job->parts()->create(['name' => 'Front brake pad set', 'quantity' => 1]);

    $this->actingAs($user)
        ->get(route('inspections.show', $item->inspection_id))
        ->assertInertia(fn ($page) => $page
            ->where('inspection.items.0.parts_status', 'planned')
            ->where('inspection.items.0.repair_job.id', $job->id)
            ->where('inspection.items.0.repair_job.parts.0.name', 'Front brake pad set')
            ->where('inspection.items.0.repair_job.parts.0.in_inventory', false)
        );
});
