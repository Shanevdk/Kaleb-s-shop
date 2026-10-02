<?php

use App\Enums\PartCategory;
use App\Enums\ServiceStatus;
use App\Models\InventoryItem;
use App\Models\PartOrder;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;
use Illuminate\Support\Facades\Http;

test('a shopper cannot open the receiving page', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('receiving.index'))
        ->assertForbidden();
});

test('a shopper cannot receive an order', function () {
    $order = PartOrder::factory()->create(['quantity_ordered' => 2]);

    $this->actingAs(User::factory()->shopper()->create())
        ->post(route('receiving.store', $order), ['quantity' => 2])
        ->assertForbidden();

    expect($order->refresh()->received_at)->toBeNull();
});

test('the receiving page lists orders still to arrive apart from those already in', function () {
    $waiting = PartOrder::factory()->create(['name' => 'Fuel pump']);
    PartOrder::factory()->received()->create(['name' => 'Alternator belt']);

    $this->actingAs(User::factory()->create())
        ->get(route('receiving.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('receiving/index')
            ->has('pending', 1)
            ->where('pending.0.id', $waiting->id)
            ->has('received', 1)
            ->where('received.0.name', 'Alternator belt')
        );
});

test('receiving a stocked part puts it on the shelf and closes the order', function () {
    $mechanic = User::factory()->create();
    $item = InventoryItem::factory()->create(['quantity' => 1, 'barcode' => null]);
    $order = PartOrder::factory()->forItem($item)->create(['quantity_ordered' => 4]);

    $this->actingAs($mechanic)
        ->post(route('receiving.store', $order), ['quantity' => 4, 'barcode' => '9312345678907'])
        ->assertRedirect(route('receiving.index'));

    $order->refresh();

    expect((float) $item->refresh()->quantity)->toBe(5.0)
        ->and($item->barcode)->toBe('9312345678907')
        ->and((float) $order->quantity_received)->toBe(4.0)
        ->and($order->received_at)->not->toBeNull()
        ->and($order->received_by)->toBe($mechanic->id);

    $this->assertDatabaseHas('stock_movements', [
        'inventory_item_id' => $item->id,
        'quantity' => 4,
        'note' => 'Received',
    ]);
});

test('a short delivery leaves the order waiting for the rest', function () {
    $item = InventoryItem::factory()->create(['quantity' => 0]);
    $order = PartOrder::factory()->forItem($item)->create(['quantity_ordered' => 4]);

    $this->actingAs(User::factory()->create())
        ->post(route('receiving.store', $order), ['quantity' => 3]);

    $order->refresh();

    expect((float) $order->quantity_received)->toBe(3.0)
        ->and($order->received_at)->toBeNull()
        ->and((float) $item->refresh()->quantity)->toBe(3.0);
});

test('receiving a part the shop never carried adds it to the inventory under the scanned description', function () {
    $mechanic = User::factory()->create();
    $order = PartOrder::factory()->create([
        'name' => 'Rear wheel bearing',
        'brand' => null,
        'quantity_ordered' => 2,
    ]);

    $this->actingAs($mechanic)->post(route('receiving.store', $order), [
        'quantity' => 2,
        'description' => 'SKF rear wheel bearing kit',
        'barcode' => '7316577912345',
        'brand' => 'SKF',
    ])->assertSessionHasNoErrors();

    $item = InventoryItem::sole();

    expect($item->name)->toBe('SKF rear wheel bearing kit')
        ->and($item->barcode)->toBe('7316577912345')
        ->and($item->brand)->toBe('SKF')
        ->and($item->category)->toBe(PartCategory::Other)
        ->and((float) $item->quantity)->toBe(2.0)
        ->and($order->refresh()->inventory_item_id)->toBe($item->id);
});

test('receiving a part under another name points the open jobs it was ordered for at it', function () {
    $mechanic = User::factory()->create();
    $job = ServiceRecord::factory()->for($mechanic)->planned()->create();
    $line = ServiceRecordPart::factory()->for($job)->create(['name' => 'Front wiper blade', 'quantity' => 1]);
    $order = PartOrder::factory()->create(['name' => 'Front wiper blade', 'quantity_ordered' => 2]);

    $this->actingAs($mechanic)->post(route('receiving.store', $order), [
        'quantity' => 2,
        'description' => 'Bosch ICON 26A',
        'barcode' => '028851333307',
    ])->assertSessionHasNoErrors();

    $item = InventoryItem::sole();

    expect($item->name)->toBe('Bosch ICON 26A')
        ->and($line->refresh()->inventory_item_id)->toBe($item->id)
        ->and($line->shortfall)->toBe(0.0);

    $this->get(route('shopping-list.index'))
        ->assertInertia(fn ($page) => $page->has('shortLines', 0));
});

test('stock booked in goes first to the finished jobs still owing it, oldest first', function () {
    $mechanic = User::factory()->create();
    $oil = InventoryItem::factory()->create(['name' => 'Engine oil', 'unit' => 'litre', 'quantity' => 0]);
    $older = ServiceRecord::factory()->create(['status' => ServiceStatus::Completed, 'performed_on' => '2026-09-01']);
    $newer = ServiceRecord::factory()->create(['status' => ServiceStatus::Completed, 'performed_on' => '2026-09-05']);

    $olderLine = ServiceRecordPart::factory()->for($older)->create([
        'inventory_item_id' => $oil->id, 'name' => $oil->name, 'unit' => 'litre', 'quantity' => 4, 'quantity_taken' => 2,
    ]);
    $newerLine = ServiceRecordPart::factory()->for($newer)->create([
        'inventory_item_id' => $oil->id, 'name' => $oil->name, 'unit' => 'litre', 'quantity' => 2, 'quantity_taken' => 0,
    ]);

    $order = PartOrder::factory()->forItem($oil)->create(['unit' => 'litre', 'quantity_ordered' => 3]);

    $this->actingAs($mechanic)
        ->post(route('receiving.store', $order), ['quantity' => 3])
        ->assertSessionHasNoErrors();

    expect((float) $olderLine->refresh()->quantity_taken)->toBe(4.0)
        ->and((float) $newerLine->refresh()->quantity_taken)->toBe(1.0)
        ->and((float) $oil->refresh()->quantity)->toBe(0.0);

    $this->assertDatabaseHas('stock_movements', [
        'service_record_id' => $older->id,
        'quantity' => -2,
        'user_id' => $mechanic->id,
    ]);
});

test('scanning a code that is on another part is refused', function () {
    $ordered = InventoryItem::factory()->create(['name' => 'Oil filter', 'quantity' => 0]);
    InventoryItem::factory()->create(['name' => 'Air filter', 'barcode' => '111']);
    $order = PartOrder::factory()->forItem($ordered)->create(['quantity_ordered' => 1]);

    $this->actingAs(User::factory()->create())
        ->post(route('receiving.store', $order), ['quantity' => 1, 'barcode' => '111'])
        ->assertSessionHasErrors(['barcode' => 'That code is on Air filter, not Oil filter.']);

    expect((float) $ordered->refresh()->quantity)->toBe(0.0)
        ->and($order->refresh()->received_at)->toBeNull();
});

test('an order that is already in cannot be received twice', function () {
    $item = InventoryItem::factory()->create(['quantity' => 2]);
    $order = PartOrder::factory()->forItem($item)->received()->create(['quantity_ordered' => 2]);

    $this->actingAs(User::factory()->create())
        ->post(route('receiving.store', $order), ['quantity' => 2])
        ->assertRedirect(route('receiving.index'))
        ->assertInertiaFlash('toast.type', 'error');

    expect((float) $item->refresh()->quantity)->toBe(2.0);
});

test('a delivery has to be at least one', function () {
    $order = PartOrder::factory()->create();

    $this->actingAs(User::factory()->create())
        ->post(route('receiving.store', $order), ['quantity' => 0])
        ->assertSessionHasErrors(['quantity' => 'Receive at least one.']);
});

test('decoding a code already on a part names the part and its open order', function () {
    Http::preventStrayRequests();
    $item = InventoryItem::factory()->create(['name' => 'Oil filter', 'barcode' => '9312345678907']);
    $order = PartOrder::factory()->forItem($item)->create();

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '9312345678907']))
        ->assertOk()
        ->assertJson([
            'description' => 'Oil filter',
            'source' => 'inventory',
            'inventory_item_id' => $item->id,
            'part_order_id' => $order->id,
        ]);
});

test('decoding an unknown retail barcode looks the description up on the open facts databases', function () {
    Http::preventStrayRequests();
    Http::fake([
        'world.openfoodfacts.org/api/v3/product/028851333307*' => Http::response([
            'status' => 'success',
            'product' => ['product_name' => 'Premium Oil Filter 3330', 'brands' => 'Bosch,Robert Bosch GmbH'],
        ]),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '028851333307']))
        ->assertOk()
        ->assertJson([
            'description' => 'Premium Oil Filter 3330',
            'brand' => 'Bosch',
            'source' => 'lookup',
            'part_order_id' => null,
        ]);

    Http::assertSent(fn ($request) => $request['product_type'] === 'all'
        && ! str_contains($request->header('User-Agent')[0], 'Guzzle'));
    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'upcitemdb'));
});

test('a code the open databases do not know is looked up on upcitemdb instead', function () {
    Http::preventStrayRequests();
    Http::fake([
        'world.openfoodfacts.org/api/v3/product/079191000823*' => Http::response(['status' => 'failure'], 404),
        'api.upcitemdb.com/prod/trial/lookup*' => Http::response([
            'items' => [['title' => 'Castrol GTX 5W-30 Motor Oil 1 Quart', 'brand' => 'Castrol']],
        ]),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '079191000823']))
        ->assertOk()
        ->assertJson([
            'description' => 'Castrol GTX 5W-30 Motor Oil 1 Quart',
            'brand' => 'Castrol',
            'source' => 'lookup',
        ]);

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api.upcitemdb.com/prod/trial/lookup?upc=079191000823'));
});

test('a shop label that is not a retail barcode is never sent off', function () {
    Http::preventStrayRequests();

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => 'SHELF-A1-42']))
        ->assertOk()
        ->assertJson(['description' => null, 'source' => null]);
});

test('a code no database knows leaves the description to be typed in', function () {
    Http::preventStrayRequests();
    Http::fake([
        'world.openfoodfacts.org/api/v3/product/028851333307*' => Http::response(['status' => 'failure'], 404),
        'api.upcitemdb.com/prod/trial/lookup*' => Http::response(['code' => 'OK', 'items' => []]),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '028851333307']))
        ->assertOk()
        ->assertJson(['description' => null, 'source' => null]);
});

test('an open facts entry with no name falls through to upcitemdb', function () {
    Http::preventStrayRequests();
    Http::fake([
        'world.openfoodfacts.org/api/v3/product/028851333307*' => Http::response(['status' => 'success', 'product' => []]),
        'api.upcitemdb.com/prod/trial/lookup*' => Http::response(['items' => [['title' => 'Oil filter', 'brand' => '']]]),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '028851333307']))
        ->assertOk()
        ->assertJson(['description' => 'Oil filter', 'brand' => null, 'source' => 'lookup']);
});

test('a spent upcitemdb allowance leaves the description to be typed in', function () {
    Http::preventStrayRequests();
    Http::fake([
        'world.openfoodfacts.org/api/v3/product/028851333307*' => Http::response(['status' => 'failure'], 404),
        'api.upcitemdb.com/prod/trial/lookup*' => Http::response(['code' => 'TOO_FAST'], 429),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('receiving.decode', ['barcode' => '028851333307']))
        ->assertOk()
        ->assertJson(['description' => null, 'source' => null]);
});
