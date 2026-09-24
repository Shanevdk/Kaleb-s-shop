<?php

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('a photo of the vehicle can be taken from a set angle and replaced', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('vehicles.photos.store', [$vehicle, 'front']), [
            'photo' => UploadedFile::fake()->image('front.jpg', 1200, 900),
        ])
        ->assertRedirect();

    $first = $vehicle->refresh()->photos['front'];
    Storage::disk('public')->assertExists($first);

    $this->actingAs($user)
        ->post(route('vehicles.photos.store', [$vehicle, 'front']), [
            'photo' => UploadedFile::fake()->image('front-again.jpg', 1200, 900),
        ])
        ->assertRedirect();

    $second = $vehicle->refresh()->photos['front'];

    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing($first);
    Storage::disk('public')->assertExists($second);
});

test('the vehicle page lists the photo urls and the angles to shoot', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create(['photos' => ['left' => 'vehicles/x/left.jpg']]);

    $this->actingAs($user)
        ->get(route('vehicles.show', $vehicle))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('vehicle.photos.left', Storage::disk('public')->url('vehicles/x/left.jpg'))
            ->has('photo_angles', 10)
            ->where('photo_angles.0.value', 'front')
            ->where('photo_angles.2.degrees', 90)
        );
});

test('a photo must be an image and the angle must be a known one', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    $this->actingAs($user)
        ->post(route('vehicles.photos.store', [$vehicle, 'front']), [
            'photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
        ])
        ->assertSessionHasErrors('photo');

    $this->actingAs($user)
        ->post(route('vehicles.photos.store', [$vehicle, 'sideways']), [
            'photo' => UploadedFile::fake()->image('x.jpg'),
        ])
        ->assertNotFound();
});

test('a photo can be removed, and all photos go with the vehicle', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->for($user)->create();

    foreach (['front', 'engine'] as $angle) {
        $this->actingAs($user)->post(route('vehicles.photos.store', [$vehicle, $angle]), [
            'photo' => UploadedFile::fake()->image("{$angle}.jpg"),
        ]);
    }

    $paths = $vehicle->refresh()->photos;

    $this->actingAs($user)
        ->delete(route('vehicles.photos.destroy', [$vehicle, 'front']))
        ->assertRedirect();

    Storage::disk('public')->assertMissing($paths['front']);
    expect($vehicle->refresh()->photos)->not->toHaveKey('front')->toHaveKey('engine');

    $this->actingAs($user)->delete(route('vehicles.destroy', $vehicle));

    Storage::disk('public')->assertMissing($paths['engine']);
});

test('a user cannot add or remove photos on another mechanic vehicle', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $vehicle = Vehicle::factory()->create(['photos' => ['rear' => 'vehicles/x/rear.jpg']]);

    $this->actingAs($user)
        ->post(route('vehicles.photos.store', [$vehicle, 'front']), [
            'photo' => UploadedFile::fake()->image('front.jpg'),
        ])
        ->assertForbidden();

    $this->actingAs($user)
        ->delete(route('vehicles.photos.destroy', [$vehicle, 'rear']))
        ->assertForbidden();

    expect($vehicle->refresh()->photos)->toHaveKey('rear');
});
