<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

/**
 * A trimmed down NHTSA decode of a 2018 Toyota Hilux double cab.
 *
 * @return array<string, mixed>
 */
function nhtsaDecode(array $overrides = []): array
{
    return ['Results' => [array_merge([
        'Make' => 'TOYOTA',
        'Model' => 'Hilux',
        'ModelYear' => '2018',
        'BodyClass' => 'Pickup',
        'VehicleType' => 'TRUCK',
        'EngineCylinders' => '4',
        'DisplacementL' => '2.8',
        'EngineConfiguration' => 'In-Line',
        'FuelTypePrimary' => 'Diesel',
        'EngineHP' => '174',
        'DriveType' => '4WD/4-Wheel Drive/4x4',
        'TransmissionStyle' => 'Automatic',
        'TransmissionSpeeds' => '6',
        'Doors' => '4',
        'PlantCity' => 'BANGKOK',
        'PlantCountry' => 'Thailand',
        'ErrorCode' => '0',
        'ErrorText' => '0 - VIN decoded clean. Check Digit (9th position) is correct',
    ], $overrides)]];
}

test('guests cannot use the lookup', function () {
    $this->get(route('lookup'))->assertRedirect(route('login'));
    $this->getJson(route('lookup.decode', ['vin' => 'MR0FZ22G001234567']))->assertUnauthorized();
});

test('the lookup page decodes a vin into specs, a machine kind and repair notes', function () {
    Http::fake(['vpic.nhtsa.dot.gov/*' => Http::response(nhtsaDecode())]);

    $this->actingAs(User::factory()->create())
        ->get(route('lookup', ['identifier' => 'mr0fz22g00 1234567']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('lookup')
            ->where('identifier', 'MR0FZ22G001234567')
            ->where('is_vin', true)
            ->where('kind', 'ute')
            ->where('specs.make', 'Toyota')
            ->where('specs.model', 'Hilux')
            ->where('specs.year', 2018)
            ->where('specs.engine.cylinders', 4)
            ->where('specs.engine.displacement_l', 2.8)
            ->where('specs.engine.fuel', 'Diesel')
            ->where('specs.transmission', '6-speed Automatic')
            ->where('specs.plant', 'Bangkok, Thailand')
            ->has('maintenance')
            ->has('repairs')
            ->has('kinds')
        );

    Http::assertSentCount(1);
});

test('a serial number that is not a vin is never sent to the decoder', function () {
    Http::fake();

    $this->actingAs(User::factory()->create())
        ->get(route('lookup', ['identifier' => 'KH-12345', 'kind' => 'mower']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('identifier', 'KH12345')
            ->where('is_vin', false)
            ->where('specs', null)
            ->where('kind', 'mower')
            ->where('maintenance.0.items.0', 'Check engine oil level')
        );

    Http::assertNothingSent();
});

test('the decode endpoint returns specs as json for the vehicle form', function () {
    Http::fake(['vpic.nhtsa.dot.gov/*' => Http::response(nhtsaDecode(['BodyClass' => 'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)']))]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('lookup.decode', ['vin' => 'JTEBU5JR0A5012345']))
        ->assertOk()
        ->assertJsonPath('is_vin', true)
        ->assertJsonPath('specs.kind', 'suv')
        ->assertJsonPath('specs.make', 'Toyota')
        ->assertJsonPath('specs.engine.horsepower', 174);
});

test('a decoder outage or unknown vin yields no specs rather than an error', function () {
    Http::fake(['vpic.nhtsa.dot.gov/*' => Http::response('', 500)]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('lookup.decode', ['vin' => 'JTEBU5JR0A5012345']))
        ->assertOk()
        ->assertJsonPath('is_vin', true)
        ->assertJsonPath('specs', null);
});
