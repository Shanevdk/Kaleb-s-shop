<?php

use App\Models\InventoryItem;
use App\Models\User;

test('guests cannot open the scanner', function () {
    $this->get(route('inventory.scan'))->assertRedirect(route('login'));
});

test('the scanner passes the scandit key through to the page', function () {
    config()->set('services.scandit.license_key', 'test-license-key');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('inventory.scan'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inventory/scan')
            ->where('scandit.license_key', 'test-license-key')
            ->has('scandit.library_location')
        );
});

test('the scanner reports no key when scandit is not configured', function () {
    config()->set('services.scandit.license_key', null);

    $this->actingAs(User::factory()->create())
        ->get(route('inventory.scan'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('scandit.license_key', ''));
});

test('the scanner only offers parts owned by the user to link against', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['name' => 'Oil filter', 'barcode' => null]);
    InventoryItem::factory()->create(['name' => 'Someone elses part']);

    $this->actingAs($user)
        ->get(route('inventory.scan'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('items', 1)
            ->where('items.0.label', 'Oil filter')
        );
});

test('a part that already has a barcode says so in the link list', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['name' => 'Oil filter', 'barcode' => '111']);

    $this->actingAs($user)
        ->get(route('inventory.scan'))
        ->assertInertia(fn ($page) => $page->where('items.0.label', 'Oil filter (already scans as 111)'));
});

test('scanning a known barcode books a unit in', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create([
        'barcode' => '9312345678907',
        'quantity' => 4,
    ]);

    $this->actingAs($user)
        ->post(route('inventory.scan.store'), ['barcode' => '9312345678907'])
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('inventory/scan')
            ->where('result.status', 'matched')
            ->where('result.item.id', $item->id)
            ->where('result.item.quantity', 5)
        );

    expect($item->refresh()->quantity)->toEqual(5.0);
});

test('a scan can book stock back out with a negative delta', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111', 'quantity' => 2]);

    $this->actingAs($user)->post(route('inventory.scan.store'), [
        'barcode' => '111',
        'delta' => -1,
    ])->assertOk();

    expect($item->refresh()->quantity)->toEqual(1.0);
});

test('a scan never takes stock below zero', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111', 'quantity' => 0]);

    $this->actingAs($user)->post(route('inventory.scan.store'), [
        'barcode' => '111',
        'delta' => -5,
    ]);

    expect($item->refresh()->quantity)->toEqual(0.0);
});

test('an unrecognised barcode comes back as unknown', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('inventory.scan.store'), ['barcode' => '404404404'])
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('result.status', 'unknown')
            ->where('result.barcode', '404404404')
            ->where('result.item', null)
        );
});

test('a barcode on someone elses part does not match', function () {
    $user = User::factory()->create();
    $other = InventoryItem::factory()->create(['barcode' => '111', 'quantity' => 4]);

    $this->actingAs($user)
        ->post(route('inventory.scan.store'), ['barcode' => '111'])
        ->assertInertia(fn ($page) => $page->where('result.status', 'unknown'));

    expect($other->refresh()->quantity)->toEqual(4.0);
});

test('scanning requires a barcode', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('inventory.scan.store'), ['barcode' => ''])
        ->assertSessionHasErrors('barcode');
});

test('an unknown barcode can be linked to an existing part', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null, 'quantity' => 3]);

    $this->actingAs($user)
        ->post(route('inventory.scan.link'), [
            'barcode' => '9312345678907',
            'inventory_item_id' => $item->id,
        ])
        ->assertRedirect(route('inventory.scan'));

    expect($item->refresh()->barcode)->toBe('9312345678907')
        ->and($item->quantity)->toEqual(4.0);
});

test('a barcode cannot be linked to two parts', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['barcode' => '111']);
    $other = InventoryItem::factory()->for($user)->create(['barcode' => null]);

    $this->actingAs($user)
        ->post(route('inventory.scan.link'), [
            'barcode' => '111',
            'inventory_item_id' => $other->id,
        ])
        ->assertSessionHasErrors('barcode');

    expect($other->refresh()->barcode)->toBeNull();
});

test('a barcode cannot be linked to someone elses part', function () {
    $item = InventoryItem::factory()->create(['barcode' => null]);

    $this->actingAs(User::factory()->create())
        ->post(route('inventory.scan.link'), [
            'barcode' => '111',
            'inventory_item_id' => $item->id,
        ])
        ->assertSessionHasErrors('inventory_item_id');

    expect($item->refresh()->barcode)->toBeNull();
});

test('the add part form is prefilled with a scanned barcode', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('inventory.create', ['barcode' => '9312345678907']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('scannedBarcode', '9312345678907'));
});

test('a part can be saved with a barcode and found by it', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Oil filter',
        'category' => 'filters',
        'barcode' => '9312345678907',
        'quantity' => 1,
        'minimum_quantity' => 0,
        'unit_cost' => 5,
    ])->assertRedirect(route('inventory.index'));

    expect(InventoryItem::firstOrFail()->barcode)->toBe('9312345678907');

    $this->actingAs($user)
        ->get(route('inventory.index', ['search' => '93123456']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.name', 'Oil filter'));
});

test('two parts cannot share a barcode', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['barcode' => '111']);

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Another part',
        'category' => 'filters',
        'barcode' => '111',
        'quantity' => 1,
        'minimum_quantity' => 0,
        'unit_cost' => 5,
    ])->assertSessionHasErrors('barcode');
});

test('a part keeps its own barcode when it is edited', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111']);

    $this->actingAs($user)->put(route('inventory.update', $item), [
        'name' => 'Renamed part',
        'category' => $item->category->value,
        'barcode' => '111',
        'quantity' => $item->quantity,
        'minimum_quantity' => $item->minimum_quantity,
        'unit_cost' => $item->unit_cost,
    ])->assertRedirect(route('inventory.index'));

    expect($item->refresh()->name)->toBe('Renamed part')
        ->and($item->barcode)->toBe('111');
});

test('a blank barcode is stored as null so many parts can go without one', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['barcode' => null]);

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'No barcode part',
        'category' => 'filters',
        'barcode' => '',
        'quantity' => 1,
        'minimum_quantity' => 0,
        'unit_cost' => 5,
    ])->assertRedirect(route('inventory.index'));

    expect(InventoryItem::where('name', 'No barcode part')->firstOrFail()->barcode)->toBeNull();
});

test('the scanner key is shared with the part form so codes can be scanned into it', function () {
    config()->set('services.scandit.license_key', 'test-license-key');

    $this->actingAs(User::factory()->create())
        ->get(route('inventory.create'))
        ->assertInertia(fn ($page) => $page->where('scandit.license_key', 'test-license-key'));
});

test('guests are not sent the scanner key', function () {
    config()->set('services.scandit.license_key', 'test-license-key');

    $this->get(route('login'))
        ->assertInertia(fn ($page) => $page->where('scandit', null));
});

test('guests cannot assign a code to a part', function () {
    $item = InventoryItem::factory()->create(['barcode' => null]);

    $this->put(route('inventory.barcode', $item), ['barcode' => '111'])
        ->assertRedirect(route('login'));

    expect($item->refresh()->barcode)->toBeNull();
});

test('a scanned code can be assigned to a part without moving its stock', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null, 'quantity' => 3]);

    $this->actingAs($user)
        ->from(route('inventory.index'))
        ->put(route('inventory.barcode', $item), ['barcode' => ' QR-SHELF-A1 '])
        ->assertRedirect(route('inventory.index'))
        ->assertSessionHasNoErrors();

    expect($item->refresh()->barcode)->toBe('QR-SHELF-A1')
        ->and($item->quantity)->toEqual(3.0);
});

test('assigning a code replaces the one a part already had', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111']);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => '222'])
        ->assertSessionHasNoErrors();

    expect($item->refresh()->barcode)->toBe('222');
});

test('rescanning the code a part already has is not rejected as taken', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111']);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => '111'])
        ->assertSessionHasNoErrors();

    expect($item->refresh()->barcode)->toBe('111');
});

test('a code already on another part cannot be assigned', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->for($user)->create(['barcode' => '111']);
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null]);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => '111'])
        ->assertSessionHasErrors(['barcode' => 'That code is already on another part.']);

    expect($item->refresh()->barcode)->toBeNull();
});

test('a code on someone elses part does not stop it being assigned', function () {
    $user = User::factory()->create();
    InventoryItem::factory()->create(['barcode' => '111']);
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null]);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => '111'])
        ->assertSessionHasNoErrors();

    expect($item->refresh()->barcode)->toBe('111');
});

test('a code cannot be assigned to someone elses part', function () {
    $item = InventoryItem::factory()->create(['barcode' => null]);

    $this->actingAs(User::factory()->create())
        ->put(route('inventory.barcode', $item), ['barcode' => '111'])
        ->assertForbidden();

    expect($item->refresh()->barcode)->toBeNull();
});

test('assigning requires a code', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => '111']);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => '   '])
        ->assertSessionHasErrors('barcode');

    expect($item->refresh()->barcode)->toBe('111');
});

test('a code longer than 255 characters is rejected', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null]);

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => str_repeat('a', 256)])
        ->assertSessionHasErrors('barcode');

    expect($item->refresh()->barcode)->toBeNull();
});

test('a QR code holding a long link can be assigned and then scanned', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null, 'quantity' => 1]);
    $link = 'https://labels.example.com/workshop/shelf-a1/bin-04?part=oil-filter&batch=2026-09-24-0001';

    $this->actingAs($user)
        ->put(route('inventory.barcode', $item), ['barcode' => $link])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->post(route('inventory.scan.store'), ['barcode' => $link])
        ->assertInertia(fn ($page) => $page
            ->where('result.status', 'matched')
            ->where('result.item.id', $item->id)
        );
});

test('an unknown QR code holding a long link can be linked from the scanner', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->for($user)->create(['barcode' => null]);
    $link = 'https://labels.example.com/workshop/shelf-a1/bin-04?part=oil-filter&batch=2026-09-24-0001';

    $this->actingAs($user)
        ->post(route('inventory.scan.link'), ['barcode' => $link, 'inventory_item_id' => $item->id])
        ->assertSessionHasNoErrors();

    expect($item->refresh()->barcode)->toBe($link);
});

test('a part can be saved with a QR code holding a long link', function () {
    $user = User::factory()->create();
    $link = 'https://labels.example.com/workshop/shelf-a1/bin-04?part=oil-filter&batch=2026-09-24-0001';

    $this->actingAs($user)->post(route('inventory.store'), [
        'name' => 'Oil filter',
        'category' => 'filters',
        'barcode' => $link,
        'quantity' => 1,
        'minimum_quantity' => 0,
        'unit_cost' => 5,
    ])->assertSessionHasNoErrors();

    expect(InventoryItem::firstOrFail()->barcode)->toBe($link);
});
