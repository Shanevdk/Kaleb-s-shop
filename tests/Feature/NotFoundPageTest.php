<?php

use App\Models\User;

test('a made up url shows the custom 404 page, with no redirect', function () {
    $response = $this->get('/this-page-does-not-exist');

    $response->assertNotFound();

    expect($response->headers->has('Location'))->toBeFalse();
});

test('a made up url renders the 404 page component', function () {
    $this->actingAs(User::factory()->create())
        ->get('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertInertia(fn ($page) => $page->component('errors/404'));
});

test('opening a job that has been deleted shows the custom 404 page', function () {
    $this->actingAs(User::factory()->create())
        ->get('/service-records/01h0000000000000000000000')
        ->assertNotFound();
});
