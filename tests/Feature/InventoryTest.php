<?php

use App\Enums\PartCategory;
use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('guests cannot see the inventory', function () {
    $this->get(route('inventory.index'))->assertRedirect(route('login'));
});

test('the inventory only shows parts owned by the user', function () {
    $user = User::factory()->create();
    $own = InventoryItem::factory()->for($user)->create();
    InventoryItem::factory()->create();

    $this->actingAs($user)
        ->get(route('inventory.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inventory/index')
            ->has('items', 1)
            ->where('items.0.id', $own->id)
        );
});

test('the inventory can be searched and filtered by category', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['name' => 'Oil filter', 'category' => PartCategory::Filters]);
    InventoryItem::factory()->for($user)->create(['name' => 'Brake pads', 'category' => PartCategory::Brakes]);

    $this->actingAs($user)
        ->get(route('inventory.index', ['search' => 'Brake']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.name', 'Brake pads'));

    $this->actingAs($user)
        ->get(route('inventory.index', ['category' => PartCategory::Filters->value]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.name', 'Oil filter'));
});

test('the inventory can be narrowed to parts that need reordering', function () {
    $user = User::factory()->create();
    $low = InventoryItem::factory()->for($user)->lowStock()->create();
    InventoryItem::factory()->for($user)->create(['quantity' => 30, 'minimum_quantity' => 2]);

    $this->actingAs($user)
        ->get(route('inventory.index', ['low_stock' => 1]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.id', $low->id));
});

test('the inventory reports stock totals', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['quantity' => 4, 'minimum_quantity' => 1, 'unit_cost' => 10]);
    InventoryItem::factory()->for($user)->lowStock()->create(['unit_cost' => 20]);

    $this->actingAs($user)
        ->get(route('inventory.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('stats.lines', 2)
            ->where('stats.units', 5)
            ->where('stats.low_stock', 1)
            ->where('stats.value', 60)
        );
});

test('a part can be added with a photo', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Oil filter',
        'category' => PartCategory::Filters->value,
        'part_number' => 'W712/75',
        'quantity' => 12,
        'minimum_quantity' => 4,
        'unit_cost' => 9.5,
        'image' => UploadedFile::fake()->image('filter.jpg'),
    ]);

    $item = InventoryItem::firstOrFail();

    $response->assertRedirect(route('inventory.index'));
    expect($item->user_id)->toBe($user->id)
        ->and($item->image_path)->not->toBeNull()
        ->and($item->is_low_stock)->toBeFalse();

    Storage::disk('public')->assertExists($item->image_path);
});

test('adding a part requires a name and a known category', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('inventory.store'), ['name' => '', 'category' => 'sprockets'])
        ->assertSessionHasErrors(['name', 'category']);

    expect(InventoryItem::count())->toBe(0);
});

test('a part photo can be replaced and the old one cleaned up', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create([
        'image_path' => UploadedFile::fake()->image('old.jpg')->store('inventory', 'public'),
    ]);
    $original = $item->image_path;

    $this->actingAs($user)->put(route('inventory.update', $item), [
        'name' => $item->name,
        'category' => $item->category->value,
        'quantity' => $item->quantity,
        'minimum_quantity' => $item->minimum_quantity,
        'unit_cost' => $item->unit_cost,
        'image' => UploadedFile::fake()->image('new.jpg'),
    ])->assertRedirect(route('inventory.index'));

    expect($item->refresh()->image_path)->not->toBe($original);
    Storage::disk('public')->assertMissing($original);
    Storage::disk('public')->assertExists($item->image_path);
});

test('a part photo can be removed', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create([
        'image_path' => UploadedFile::fake()->image('old.jpg')->store('inventory', 'public'),
    ]);
    $original = $item->image_path;

    $this->actingAs($user)->put(route('inventory.update', $item), [
        'name' => $item->name,
        'category' => $item->category->value,
        'quantity' => $item->quantity,
        'minimum_quantity' => $item->minimum_quantity,
        'unit_cost' => $item->unit_cost,
        'remove_image' => true,
    ]);

    expect($item->refresh()->image_path)->toBeNull();
    Storage::disk('public')->assertMissing($original);
});

test('a part belonging to someone else cannot be edited', function () {
    $item = InventoryItem::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('inventory.edit', $item))
        ->assertForbidden();
});

test('stock can be taken off the shelf and put back', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 3]);

    $this->actingAs($user)
        ->patch(route('inventory.adjust', $item), ['delta' => -1])
        ->assertRedirect();

    expect($item->refresh()->quantity)->toEqual(2.0);

    $this->actingAs($user)->patch(route('inventory.adjust', $item), ['delta' => 5]);

    expect($item->refresh()->quantity)->toEqual(7.0);
});

test('stock never drops below zero', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['quantity' => 1]);

    $this->actingAs($user)->patch(route('inventory.adjust', $item), ['delta' => -5]);

    expect($item->refresh()->quantity)->toEqual(0.0);
});

test('stock on someone elses part cannot be adjusted', function () {
    $item = InventoryItem::factory()->create(['quantity' => 3]);

    $this->actingAs(User::factory()->create())
        ->patch(route('inventory.adjust', $item), ['delta' => -1])
        ->assertForbidden();

    expect($item->refresh()->quantity)->toEqual(3.0);
});

test('a part can be deleted along with its photo', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create([
        'image_path' => UploadedFile::fake()->image('part.jpg')->store('inventory', 'public'),
    ]);
    $image = $item->image_path;

    $this->actingAs($user)
        ->delete(route('inventory.destroy', $item))
        ->assertRedirect(route('inventory.index'));

    expect(InventoryItem::count())->toBe(0);
    Storage::disk('public')->assertMissing($image);
});
