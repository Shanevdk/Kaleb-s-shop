<?php

use App\Models\User;

test('guests cannot open the screen saver settings', function () {
    $this->get(route('screen-saver.edit'))->assertRedirect(route('login'));
});

test('everyone on the team can open the screen saver settings', function (string $role) {
    $this->actingAs(User::factory()->create(['role' => $role]))
        ->get(route('screen-saver.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('settings/screen-saver'));
})->with(['admin', 'mechanic', 'scheduler', 'shopper']);
