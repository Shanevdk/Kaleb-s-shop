<?php

use App\Enums\MachineKind;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * A chat completion whose answer is the given text.
 *
 * @return array<string, mixed>
 */
function diagnosisReply(string $content): array
{
    return [
        'model' => 'first/model:free',
        'choices' => [['finish_reason' => 'stop', 'message' => ['role' => 'assistant', 'content' => $content]]],
    ];
}

/**
 * A well formed diagnosis from the model.
 *
 * @return array<string, mixed>
 */
function misfireDiagnosis(): array
{
    return [
        'summary' => 'Most likely a failed ignition coil on cylinder 3.',
        'causes' => [
            [
                'cause' => 'Failed ignition coil',
                'likelihood' => 'high',
                'why' => 'P0303 points at cylinder 3 and coils are a known weak spot.',
                'checks' => ['Swap coil 3 with coil 1', 'See if the misfire moves to cylinder 1'],
                'fix' => 'Replace the coil.',
                'parts' => ['Ignition coil', 'Spark plug'],
            ],
            [
                'cause' => 'Leaking injector',
                'likelihood' => 'certain',
                'checks' => [],
                'parts' => [],
            ],
        ],
        'first_steps' => ['Read freeze frame data'],
        'safety' => ['Do not drive with a flashing check engine light'],
        'questions' => ['Does it misfire cold or hot?'],
    ];
}

/**
 * The fields a manually described problem sends.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function problem(array $overrides = []): array
{
    return [
        'kind' => MachineKind::Ute->value,
        'make' => 'Toyota',
        'model' => 'Hilux',
        'year' => 2016,
        'engine' => '2.7 L petrol',
        'codes' => 'P0303',
        'symptoms' => 'Rough idle and misfire under load',
        ...$overrides,
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

test('a shopper cannot open the problem page', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('diagnose'))
        ->assertForbidden();
});

test('a shopper cannot run a diagnosis', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->postJson(route('diagnose.run'), problem())
        ->assertForbidden();

    Http::assertNothingSent();
});

test('the problem page offers the shop vehicles to diagnose', function () {
    $vehicle = Vehicle::factory()->create(['make' => 'Toyota', 'model' => 'Hilux', 'year' => 2016]);

    $this->actingAs(User::factory()->create())
        ->get(route('diagnose'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('diagnose')
            ->where('isConfigured', true)
            ->where('vehicles.0.id', $vehicle->id)
            ->where('vehicles.0.make', 'Toyota')
            ->where('vehicles.0.year', 2016)
            ->has('kinds')
        );
});

test('a problem needs symptoms and a make and model when no shop vehicle is picked', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), ['symptoms' => ''])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'symptoms' => 'Describe what it is doing.',
            'make' => 'Pick a shop vehicle or type the make.',
            'model' => 'Pick a shop vehicle or type the model.',
        ]);

    Http::assertNothingSent();
});

test('a described problem is diagnosed with likely causes, checks and stocked parts', function () {
    Http::fake([
        'openrouter.ai/*' => Http::response(diagnosisReply(json_encode(misfireDiagnosis()))),
        'api.nhtsa.gov/*' => Http::response(['results' => []]),
    ]);
    $coil = InventoryItem::factory()->create(['name' => 'Ignition coil pack', 'quantity' => 3]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), problem())
        ->assertOk()
        ->assertJsonPath('machine.title', '2016 Toyota Hilux')
        ->assertJsonPath('diagnosis.summary', 'Most likely a failed ignition coil on cylinder 3.')
        ->assertJsonPath('diagnosis.causes.0.likelihood', 'high')
        ->assertJsonPath('diagnosis.causes.0.checks.1', 'See if the misfire moves to cylinder 1')
        ->assertJsonPath('diagnosis.causes.0.parts.0.in_stock.id', $coil->id)
        ->assertJsonPath('diagnosis.causes.0.parts.1.in_stock', null)
        ->assertJsonPath('diagnosis.causes.1.likelihood', 'medium')
        ->assertJsonPath('diagnosis.safety.0', 'Do not drive with a flashing check engine light')
        ->assertJsonPath('model', 'first/model:free')
        ->assertJsonPath('error', null);

    Http::assertSent(function (Request $request): bool {
        if (! str_contains($request->url(), 'openrouter.ai')) {
            return false;
        }

        $brief = $request['messages'][1]['content'];

        return str_contains($brief, '2016 Toyota Hilux (Ute / pickup)')
            && str_contains($brief, 'Engine: 2.7 L petrol')
            && str_contains($brief, 'Fault codes: P0303')
            && str_contains($brief, 'Symptoms: Rough idle and misfire under load');
    });
});

test('a shop vehicle brings its details and service history to the diagnosis', function () {
    Http::fake([
        'openrouter.ai/*' => Http::response(diagnosisReply(json_encode(misfireDiagnosis()))),
        'api.nhtsa.gov/*' => Http::response(['results' => []]),
    ]);
    $vehicle = Vehicle::factory()->create(['make' => 'Ford', 'model' => 'Ranger', 'year' => 2019, 'odometer' => 142000]);
    ServiceRecord::factory()->for($vehicle)->create(['title' => 'Replaced spark plugs', 'performed_on' => '2026-08-01']);

    $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), ['vehicle_id' => $vehicle->id, 'symptoms' => 'Misfire when cold'])
        ->assertOk()
        ->assertJsonPath('machine.title', '2019 Ford Ranger');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'openrouter.ai')
        && str_contains($request['messages'][1]['content'], 'Odometer or hours: 142000')
        && str_contains($request['messages'][1]['content'], '2026-08-01: Replaced spark plugs'));
});

test('a diagnosis wrapped in chatter and code fences is still read', function () {
    Http::fake([
        'openrouter.ai/*' => Http::response(diagnosisReply("Here you go:\n```json\n".json_encode(misfireDiagnosis())."\n```")),
        'api.nhtsa.gov/*' => Http::response(['results' => []]),
    ]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), problem())
        ->assertOk()
        ->assertJsonPath('diagnosis.causes.0.cause', 'Failed ignition coil')
        ->assertJsonPath('reply', null);
});

test('a plain text answer is passed on as it is', function () {
    Http::fake([
        'openrouter.ai/*' => Http::response(diagnosisReply('Check the coil on cylinder 3 first.')),
        'api.nhtsa.gov/*' => Http::response(['results' => []]),
    ]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), problem())
        ->assertOk()
        ->assertJsonPath('diagnosis', null)
        ->assertJsonPath('reply', 'Check the coil on cylinder 3 first.');
});

test('without the ai the common problems matching the symptoms and the recalls still come back', function () {
    config(['services.openrouter.key' => null]);
    Http::fake([
        'api.nhtsa.gov/recalls/*' => Http::response(['results' => [[
            'NHTSACampaignNumber' => '16V123000',
            'Component' => 'ENGINE',
            'Summary' => 'Coil may fail.',
        ]]]),
    ]);

    $response = $this->actingAs(User::factory()->create())
        ->postJson(route('diagnose.run'), problem())
        ->assertOk()
        ->assertJsonPath('diagnosis', null)
        ->assertJsonPath('error', 'The assistant is not set up yet. Add an OPENROUTER_API_KEY to the environment.')
        ->assertJsonPath('recalls.0.campaign', '16V123000');

    expect($response->json('common_repairs.0.symptom'))->toBe('Rough idle or misfire');

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'openrouter.ai'));
});
