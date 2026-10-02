<?php

use App\Actions\RecordStockMovement;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;

test('two movements made from copies of a part loaded before either both count', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->create(['quantity' => 10]);

    $first = InventoryItem::findOrFail($item->id);
    $second = InventoryItem::findOrFail($item->id);

    app(RecordStockMovement::class)->handle($user, $first, -4);
    app(RecordStockMovement::class)->handle($user, $second, 1);

    expect($item->refresh()->quantity)->toEqual(7.0)
        ->and((float) $first->quantity)->toBe(6.0)
        ->and((float) $second->quantity)->toBe(7.0)
        ->and($second->isDirty())->toBeFalse();
});

test('a movement from a stale copy never takes the shelf below zero', function () {
    $user = User::factory()->create();
    $item = InventoryItem::factory()->create(['quantity' => 5]);
    $stale = InventoryItem::findOrFail($item->id);

    app(RecordStockMovement::class)->handle($user, $item, -4);
    $movement = app(RecordStockMovement::class)->handle($user, $stale, -4);

    expect($item->refresh()->quantity)->toEqual(0.0)
        ->and((float) $movement->quantity)->toBe(-1.0);
});

test('a movement can be recorded without anyone to put it down to', function () {
    $item = InventoryItem::factory()->create(['quantity' => 5]);

    app(RecordStockMovement::class)->handle(null, $item, -2, ['note' => 'Front brakes']);

    $movement = StockMovement::sole();

    expect($movement->user_id)->toBeNull()
        ->and((float) $movement->quantity)->toBe(-2.0)
        ->and($item->refresh()->quantity)->toEqual(3.0);
});
