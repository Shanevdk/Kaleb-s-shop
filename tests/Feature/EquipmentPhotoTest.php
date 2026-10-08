<?php

use App\Models\Equipment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('several photos can be added at once, after the ones already there, and are listed on its page', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $equipment = Equipment::factory()->create(['photos' => ['equipment/x/first.webp']]);

    $this->actingAs($user)
        ->post(route('equipment.photos.store', $equipment), [
            'photos' => [
                UploadedFile::fake()->image('plate.jpg', 4000, 3000),
                UploadedFile::fake()->image('side.jpg', 800, 600),
            ],
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $photos = $equipment->refresh()->photos;

    expect($photos)->toHaveCount(3)
        ->and($photos[0])->toBe('equipment/x/first.webp')
        ->and($photos[1])->toStartWith("equipment/{$equipment->id}/")->toEndWith('.webp');

    $size = getimagesizefromstring(Storage::disk('public')->get($photos[1]));
    expect([$size[0], $size[1]])->toBe([1600, 1200]);

    $this->actingAs($user)
        ->get(route('equipment.show', $equipment))
        ->assertInertia(fn ($page) => $page
            ->has('equipment.photos', 3)
            ->where('equipment.photos.0', [
                'id' => 'first.webp',
                'url' => Storage::disk('public')->url('equipment/x/first.webp'),
            ])
        );
});

test('only photos can be added', function () {
    Storage::fake('public');
    $equipment = Equipment::factory()->create();

    $this->actingAs(User::factory()->create())
        ->post(route('equipment.photos.store', $equipment), [
            'photos' => [UploadedFile::fake()->create('manual.pdf', 100, 'application/pdf')],
        ])
        ->assertSessionHasErrors(['photos.0' => 'Only photos can be added.']);

    expect($equipment->refresh()->photos)->toBeNull();
});

test('no more photos can be added than there is room for', function () {
    Storage::fake('public');
    $equipment = Equipment::factory()->create([
        'photos' => array_map(fn (int $number): string => "equipment/x/{$number}.webp", range(1, Equipment::MAX_PHOTOS - 1)),
    ]);

    $this->actingAs(User::factory()->create())
        ->post(route('equipment.photos.store', $equipment), [
            'photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
        ])
        ->assertSessionHasErrors(['photos' => 'There is only room for 1 more.']);

    expect($equipment->refresh()->photos)->toHaveCount(Equipment::MAX_PHOTOS - 1);
});

test('a photo can be removed, and the rest go with the equipment', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $equipment = Equipment::factory()->create();

    $this->actingAs($user)->post(route('equipment.photos.store', $equipment), [
        'photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
    ]);

    [$first, $second] = $equipment->refresh()->photos;

    $this->actingAs($user)
        ->delete(route('equipment.photos.destroy', [$equipment, basename($first)]))
        ->assertRedirect();

    Storage::disk('public')->assertMissing($first);
    expect($equipment->refresh()->photos)->toBe([$second]);

    $this->actingAs($user)->delete(route('equipment.destroy', $equipment));

    Storage::disk('public')->assertMissing($second);
});

test('a photo of another piece of equipment cannot be removed through this one', function () {
    Storage::fake('public');
    Storage::disk('public')->put('equipment/other/kept.webp', 'photo');
    $other = Equipment::factory()->create(['photos' => ['equipment/other/kept.webp']]);
    $equipment = Equipment::factory()->create();

    $this->actingAs(User::factory()->create())
        ->delete(route('equipment.photos.destroy', [$equipment, 'kept.webp']))
        ->assertRedirect();

    Storage::disk('public')->assertExists('equipment/other/kept.webp');
    expect($other->refresh()->photos)->toBe(['equipment/other/kept.webp']);
});

test('an account without the equipment\'s division permission cannot add or remove its photos', function () {
    Storage::fake('public');
    $user = User::factory()->shopper()->create(['permissions' => ['equipment']]);
    $equipment = Equipment::factory()->usa()->create(['photos' => ['equipment/x/kept.webp']]);

    $this->actingAs($user)
        ->post(route('equipment.photos.store', $equipment), [
            'photos' => [UploadedFile::fake()->image('a.jpg')],
        ])
        ->assertForbidden();

    $this->actingAs($user)
        ->delete(route('equipment.photos.destroy', [$equipment, 'kept.webp']))
        ->assertForbidden();

    expect($equipment->refresh()->photos)->toBe(['equipment/x/kept.webp']);
});
