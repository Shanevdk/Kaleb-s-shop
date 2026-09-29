<?php

use App\Models\User;

test('a shopper lands on the shopping list instead of the dashboard', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route('dashboard'))
        ->assertRedirect(route('shopping-list.index'));
});

test('mechanics and admins get the dashboard', function (string $role) {
    $this->actingAs(User::factory()->create(['role' => $role]))
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('dashboard'));
})->with(['mechanic', 'admin']);

test('a shopper cannot open anything but the shopping list', function (string $route) {
    $this->actingAs(User::factory()->shopper()->create())
        ->get(route($route))
        ->assertForbidden();
})->with([
    'vehicles.index',
    'vehicles.create',
    'service-records.index',
    'service-records.create',
    'inspections.index',
    'schedule.index',
    'inventory.index',
    'inventory.scan',
    'lookup',
    'assistant',
    'admin.users.index',
]);

test('a shopper cannot add records', function () {
    $this->actingAs(User::factory()->shopper()->create())
        ->post(route('vehicles.store'), ['make' => 'Toyota', 'model' => 'Hilux', 'year' => 2018])
        ->assertForbidden();
});

test('every page tells the front end what the signed in person can do', function (string $role, bool $manageTeam, bool $workOnRecords) {
    $this->actingAs(User::factory()->create(['role' => $role]))
        ->get(route('shopping-list.index'))
        ->assertInertia(fn ($page) => $page
            ->where('auth.role', $role)
            ->where('auth.can.manageTeam', $manageTeam)
            ->where('auth.can.workOnRecords', $workOnRecords)
        );
})->with([
    'admin' => ['admin', true, true],
    'mechanic' => ['mechanic', false, true],
    'shopper' => ['shopper', false, false],
]);
