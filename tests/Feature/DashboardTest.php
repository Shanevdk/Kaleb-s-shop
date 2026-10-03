<?php

use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('an account with only the equipment permission lands on the equipment list', function () {
    $user = User::factory()->shopper()->create(['permissions' => ['equipment']]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('equipment.index'));
});

test('an account with only the VDK Equipment USA permission lands on its equipment list', function () {
    $user = User::factory()->shopper()->create(['permissions' => ['equipment-usa']]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('usa.equipment.index'));
});
