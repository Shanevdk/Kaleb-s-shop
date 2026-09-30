<?php

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * A chat completion from a vision model whose answer is the given text.
 *
 * @return array<string, mixed>
 */
function lookReply(string $content, string $model = 'first/vision:free'): array
{
    return [
        'model' => $model,
        'choices' => [['finish_reason' => 'stop', 'message' => ['role' => 'assistant', 'content' => $content]]],
    ];
}

/**
 * A well formed reading of a white van's photos.
 *
 * @return array<string, mixed>
 */
function whiteVanLook(): array
{
    return [
        'colour' => ['name' => 'white', 'hex' => '#f2f2ee', 'finish' => 'solid'],
        'body_style' => 'van',
        'cab' => null,
        'roof' => 'high',
        'wheels' => ['style' => 'steel', 'spokes' => null, 'colour' => 'black'],
        'tinted_windows' => false,
        'accessories' => ['ladder_rack', 'tow_bar'],
        'damage' => [
            ['area' => 'rear_bumper', 'kind' => 'scrape', 'severity' => 'minor', 'note' => 'Scuffed corner'],
        ],
        'summary' => 'A white high-roof van with a ladder rack and a tow bar.',
        'confidence' => 0.8,
    ];
}

/**
 * Put photos of the vehicle from the given angles on the public disk.
 *
 * @param  array<int, string>  $angles
 */
function photographVehicle(Vehicle $vehicle, array $angles): Vehicle
{
    $photos = [];

    foreach ($angles as $angle) {
        $photos[$angle] = UploadedFile::fake()->image("{$angle}.jpg", 800, 600)->store("vehicles/{$vehicle->id}", 'public');
    }

    $vehicle->update(['photos' => $photos]);

    return $vehicle;
}

beforeEach(function () {
    config([
        'services.openrouter.key' => 'test-key',
        'services.openrouter.vision_models' => ['first/vision:free', 'second/vision:free'],
    ]);
    Http::preventStrayRequests();
});

test('guests cannot have a vehicle matched to its photos', function () {
    $vehicle = Vehicle::factory()->create();

    $this->postJson(route('vehicles.look.store', $vehicle))->assertUnauthorized();
});

test('a shopper cannot have a vehicle matched to its photos', function () {
    Storage::fake('public');
    $vehicle = photographVehicle(Vehicle::factory()->create(), ['front_left']);

    $this->actingAs(User::factory()->shopper()->create())
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertForbidden();

    Http::assertNothingSent();
});

test('matching needs a photo of the outside of the vehicle', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['engine']);

    $this->actingAs($user)
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['photos' => 'Take at least one photo of the outside first.']);

    Http::assertNothingSent();
});

test('the outside photos go to a vision model on one contact sheet and what it sees is kept', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(
        Vehicle::factory()->for($user)->create(['year' => 2020, 'make' => 'Ford', 'model' => 'Transit', 'colour' => null]),
        ['rear', 'front_left', 'engine'],
    );
    Http::fake(['openrouter.ai/*' => Http::response(lookReply(json_encode(whiteVanLook())))]);

    $this->actingAs($user)
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertOk()
        ->assertJsonPath('look.colour.name', 'white')
        ->assertJsonPath('look.roof', 'high')
        ->assertJsonPath('look.accessories', ['ladder_rack', 'tow_bar'])
        ->assertJsonPath('look.stale', false)
        ->assertJsonMissingPath('look.sources');

    $look = $vehicle->refresh()->look;
    expect($look)->toMatchArray([
        ...whiteVanLook(),
        'angles' => ['front_left', 'rear'],
        'sources' => $vehicle->photosToStudy(),
        'model' => 'first/vision:free',
    ]);

    Http::assertSent(function (Request $request): bool {
        $text = $request['messages'][1]['content'][0]['text'];
        $sheet = $request['messages'][1]['content'][1]['image_url']['url'];
        [$width, $height] = getimagesizefromstring(base64_decode(substr($sheet, strlen('data:image/jpeg;base64,'))));

        return $request['model'] === 'first/vision:free'
            && str_contains($text, '2020 Ford Transit')
            && str_contains($text, 'No colour on file.')
            && str_contains($text, '2 photos: 1 Front left, 2 Rear.')
            && ! str_contains($text, 'Engine')
            && str_starts_with($sheet, 'data:image/jpeg;base64,')
            && [$width, $height] === [1280, 506];
    });
});

test('the answer is trimmed to what the 3D model can show', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['front_left']);
    $answer = [
        'colour' => ['name' => 'Arctic White', 'hex' => '#FFF', 'finish' => 'glossy'],
        'body_style' => 'Pickup truck',
        'cab' => 'Dual',
        'roof' => 'tall',
        'wheels' => ['style' => 'Alloy', 'spokes' => 40, 'colour' => 'purple'],
        'tinted_windows' => 'yes',
        'accessories' => ['Bull bar', 'snorkel', 'flux capacitor', 'bull-bar'],
        'damage' => [
            ['area' => 'boot', 'kind' => 'Dent', 'note' => 'Small dent near the badge'],
            'a scratch somewhere',
        ],
        'summary' => 'A white dual cab ute.',
        'confidence' => 7,
    ];
    Http::fake([
        'openrouter.ai/*' => Http::response(lookReply("Here is what I see:\n```json\n".json_encode($answer)."\n```")),
    ]);

    $this->actingAs($user)->postJson(route('vehicles.look.store', $vehicle))->assertOk();

    expect($vehicle->refresh()->look)->toMatchArray([
        'colour' => ['name' => 'Arctic White', 'hex' => '#ffffff', 'finish' => 'solid'],
        'body_style' => null,
        'cab' => 'dual',
        'roof' => null,
        'wheels' => ['style' => 'alloy', 'spokes' => null, 'colour' => null],
        'tinted_windows' => null,
        'accessories' => ['bull_bar', 'snorkel'],
        'damage' => [['area' => 'other', 'kind' => 'dent', 'severity' => 'minor', 'note' => 'Small dent near the badge']],
        'summary' => 'A white dual cab ute.',
        'confidence' => 1,
    ]);
});

test('an answer that cannot be read goes to the next vision model', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['front']);
    Http::fake([
        'openrouter.ai/*' => Http::sequence()
            ->push(lookReply('Sorry, I cannot see any pictures.'))
            ->push(lookReply(json_encode(whiteVanLook()), 'second/vision:free')),
    ]);

    $this->actingAs($user)
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertOk()
        ->assertJsonPath('look.model', 'second/vision:free');

    Http::assertSentCount(2);
    Http::assertSent(fn (Request $request): bool => $request['model'] === 'second/vision:free');
});

test('it says so when no vision model can make sense of the photos', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['front']);
    Http::fake(['openrouter.ai/*' => Http::response(lookReply('It is a car.'))]);

    $this->actingAs($user)
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertServiceUnavailable()
        ->assertJsonPath('message', 'The AI could not make sense of the photos. Try again in a minute.');

    Http::assertSentCount(2);
    expect($vehicle->refresh()->look)->toBeNull();
});

test('it says so when the AI is not set up', function () {
    Storage::fake('public');
    config(['services.openrouter.key' => null]);
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['front']);

    $this->actingAs($user)
        ->postJson(route('vehicles.look.store', $vehicle))
        ->assertServiceUnavailable()
        ->assertJsonPath('message', 'The assistant is not set up yet. Add an OPENROUTER_API_KEY to the environment.');

    Http::assertNothingSent();
});

test('the vehicle page shows the look, marked stale once the photos change', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = photographVehicle(Vehicle::factory()->for($user)->create(), ['front_left', 'rear']);
    $vehicle->update(['look' => [...whiteVanLook(), 'sources' => $vehicle->photosToStudy()]]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertInertia(fn ($page) => $page
            ->where('vehicle.look.roof', 'high')
            ->where('vehicle.look.stale', false)
            ->missing('vehicle.look.sources'));

    $vehicle->update(['photos' => [...$vehicle->photos, 'rear' => 'vehicles/x/new-rear.jpg']]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertInertia(fn ($page) => $page->where('vehicle.look.stale', true));
});

test('the match can be forgotten, putting the model back', function () {
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create(['look' => whiteVanLook()]);

    $this->actingAs($user)
        ->delete(route('vehicles.look.destroy', $vehicle))
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'The model is back to how it was.');

    expect($vehicle->refresh()->look)->toBeNull();
});
