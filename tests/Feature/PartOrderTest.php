<?php

use App\Enums\ServiceStatus;
use App\Models\InventoryItem;
use App\Models\PartOrder;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\User;

test('guests cannot tick a part off as ordered', function () {
    $this->post(route('shopping-list.orders.store'), [
        'name' => 'Rear wheel bearing',
        'unit' => 'each',
        'quantity' => 2,
    ])->assertRedirect(route('login'));

    expect(PartOrder::count())->toBe(0);
});

test('a shopper can tick a line off as ordered with how many were ordered', function () {
    $shopper = User::factory()->shopper()->create();
    $item = InventoryItem::factory()->create(['name' => 'Air filter']);

    $this->actingAs($shopper)
        ->from(route('shopping-list.index'))
        ->post(route('shopping-list.orders.store'), [
            'inventory_item_id' => $item->id,
            'name' => 'Air filter',
            'unit' => 'each',
            'quantity' => 6,
        ])
        ->assertRedirect(route('shopping-list.index'));

    $order = PartOrder::sole();

    expect($order->user_id)->toBe($shopper->id)
        ->and($order->inventory_item_id)->toBe($item->id)
        ->and((float) $order->quantity_ordered)->toBe(6.0)
        ->and($order->received_at)->toBeNull();
});

test('changing the amount on a ticked line updates the order rather than adding another', function () {
    $user = User::factory()->create();
    PartOrder::factory()->create(['name' => 'Rear wheel bearing', 'quantity_ordered' => 2]);

    $this->actingAs($user)->post(route('shopping-list.orders.store'), [
        'name' => 'rear wheel bearing',
        'unit' => 'each',
        'quantity' => 5,
    ])->assertSessionHasNoErrors();

    expect((float) PartOrder::sole()->quantity_ordered)->toBe(5.0);
});

test('an order needs at least one', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('shopping-list.orders.store'), [
            'name' => 'Rear wheel bearing',
            'unit' => 'each',
            'quantity' => 0,
        ])
        ->assertSessionHasErrors(['quantity' => 'Order at least one.']);

    expect(PartOrder::count())->toBe(0);
});

test('a line ticked by mistake can be unticked', function () {
    $order = PartOrder::factory()->create();

    $this->actingAs(User::factory()->shopper()->create())
        ->delete(route('shopping-list.orders.destroy', $order))
        ->assertRedirect();

    $this->assertModelMissing($order);
});

test('an order that has started arriving cannot be unticked', function () {
    $order = PartOrder::factory()->create(['quantity_ordered' => 4, 'quantity_received' => 1]);

    $this->actingAs(User::factory()->create())
        ->delete(route('shopping-list.orders.destroy', $order))
        ->assertRedirect()
        ->assertInertiaFlash('toast.type', 'error');

    $this->assertModelExists($order);
});

test('the shopping list shows which lines are ordered and how many', function () {
    $user = User::factory()->create();
    $record = ServiceRecord::factory()->for($user)->create(['status' => ServiceStatus::Planned]);
    ServiceRecordPart::factory()->for($record)->create(['name' => 'Rear wheel bearing', 'quantity' => 2]);
    ServiceRecordPart::factory()->for($record)->create(['name' => 'Fuel pump', 'quantity' => 1]);
    $order = PartOrder::factory()->create(['name' => 'Rear wheel bearing', 'quantity_ordered' => 3]);
    PartOrder::factory()->received()->create(['name' => 'Fuel pump']);

    $this->actingAs($user)
        ->get(route('shopping-list.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('shortLines.0.name', 'Fuel pump')
            ->where('shortLines.0.order', null)
            ->where('shortLines.1.name', 'Rear wheel bearing')
            ->where('shortLines.1.order.id', $order->id)
            ->where('shortLines.1.order.quantity_ordered', 3)
            ->where('stats.ordered', 1)
        );
});
