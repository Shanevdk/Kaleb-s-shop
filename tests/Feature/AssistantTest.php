<?php

use App\Models\User;

test('guests cannot see the assistant', function () {
    $this->get(route('assistant'))->assertRedirect(route('login'));
});

test('the assistant page renders for a signed in mechanic', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('assistant'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('assistant'));
});
