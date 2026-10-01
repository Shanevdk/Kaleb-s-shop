<?php

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
function estimateReply(string $content): array
{
    return [
        'model' => 'first/model:free',
        'choices' => [['finish_reason' => 'stop', 'message' => ['role' => 'assistant', 'content' => $content]]],
    ];
}

/**
 * A well formed estimate from the model.
 *
 * @return array<string, mixed>
 */
function brakeJobEstimate(): array
{
    return [
        'hours' => 2.5,
        'range' => ['low' => 2, 'high' => 3],
        'reasoning' => 'Pads, rotors and a bleed, plus getting the wheels off.',
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

test('a shopper cannot estimate a job', function () {
    $record = ServiceRecord::factory()->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->postJson(route('service-records.estimate.store', $record))
        ->assertForbidden();

    Http::assertNothingSent();
});

test('the AI estimates the job from its notes and the vehicle, and the estimate is put at the top of the notes', function () {
    Http::fake(['openrouter.ai/*' => Http::response(estimateReply(json_encode(brakeJobEstimate())))]);
    $vehicle = Vehicle::factory()->create(['make' => 'Ford', 'model' => 'Ranger', 'year' => 2019, 'odometer' => 142000]);
    $record = ServiceRecord::factory()->for($vehicle)->create([
        'title' => 'Front brake pads and rotors',
        'description' => 'Original saved notes.',
    ]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('service-records.estimate.store', $record), ['notes' => 'Customer says pedal is soft.'])
        ->assertOk()
        ->assertJsonPath('hours', 2.5)
        ->assertJsonPath('low', 2)
        ->assertJsonPath('high', 3)
        ->assertJsonPath('model', 'first/model:free')
        ->assertJsonPath('description', "Estimated time: 2.5 hours (2–3 hrs range) — Pads, rotors and a bleed, plus getting the wheels off.\n\nCustomer says pedal is soft.");

    Http::assertSent(function (Request $request): bool {
        $brief = $request['messages'][1]['content'];

        return str_contains($brief, 'Front brake pads and rotors')
            && str_contains($brief, 'Customer says pedal is soft.')
            && str_contains($brief, '2019 Ford Ranger')
            && str_contains($brief, 'Odometer or hours: 142000');
    });

    // Nothing is saved until the mechanic keeps the estimate and submits
    // the form themselves.
    expect($record->fresh()->description)->toBe('Original saved notes.');
});

test('estimating again replaces the estimate already at the top of the notes instead of piling up', function () {
    Http::fake(['openrouter.ai/*' => Http::response(estimateReply(json_encode(brakeJobEstimate())))]);
    $record = ServiceRecord::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('service-records.estimate.store', $record), [
            'notes' => "Estimated time: 4 hours — an older guess.\n\nCustomer says pedal is soft.",
        ])
        ->assertOk()
        ->assertJsonPath('description', "Estimated time: 2.5 hours (2–3 hrs range) — Pads, rotors and a bleed, plus getting the wheels off.\n\nCustomer says pedal is soft.");
});

test('an estimate can be asked for with no notes yet', function () {
    Http::fake(['openrouter.ai/*' => Http::response(estimateReply(json_encode(brakeJobEstimate())))]);
    $record = ServiceRecord::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('service-records.estimate.store', $record))
        ->assertOk()
        ->assertJsonPath('description', 'Estimated time: 2.5 hours (2–3 hrs range) — Pads, rotors and a bleed, plus getting the wheels off.');
});

test('without the ai configured the estimate fails clearly', function () {
    config(['services.openrouter.key' => null]);
    $record = ServiceRecord::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('service-records.estimate.store', $record))
        ->assertStatus(503)
        ->assertJsonPath('message', 'The assistant is not set up yet. Add an OPENROUTER_API_KEY to the environment.');

    Http::assertNothingSent();
});

test('an unusable answer from the ai fails clearly rather than saving nonsense', function () {
    Http::fake(['openrouter.ai/*' => Http::response(estimateReply('Sorry, I cannot help with that.'))]);
    $record = ServiceRecord::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('service-records.estimate.store', $record))
        ->assertStatus(503)
        ->assertJsonPath('message', 'The AI could not work out an estimate. Try again in a moment.');
});
