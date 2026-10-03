<?php

use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

test('someone who signs up is kept waiting for an administrator', function () {
    Notification::fake();

    $this->post(route('register.store'), [
        'name' => 'Walk In',
        'email' => 'walkin@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $user = User::where('email', 'walkin@example.com')->firstOrFail();

    expect($user->status)->toBe(AccountStatus::Pending)
        ->and($user->email_verified_at)->toBeNull();

    $this->get(route('dashboard'))->assertRedirect(route('account.pending'));

    // Accepting them vouches for the address, so no link is mailed out.
    Notification::assertNothingSent();
});

test('an account waiting for approval gets nothing', function (string $method, string $uri) {
    $this->actingAs(User::factory()->pending()->create())
        ->call($method, $uri)
        ->assertRedirect(route('account.pending'));
})->with([
    ['GET', '/dashboard'],
    ['GET', '/vehicles'],
    ['GET', '/shopping-list'],
    ['GET', '/settings/profile'],
    ['POST', '/vehicles'],
]);

test('an account waiting for approval holds no permissions', function () {
    $user = User::factory()->admin()->pending()->create();

    expect($user->can('manage-team'))->toBeFalse()
        ->and($user->can('shopping-list'))->toBeFalse();
});

test('an account waiting for approval is refused json', function () {
    $this->actingAs(User::factory()->pending()->create())
        ->getJson(route('screen-saver.data'))
        ->assertForbidden();
});

test('the waiting page says whether the request is still pending or was declined', function (string $state) {
    $this->actingAs(User::factory()->{$state}()->create())
        ->get(route('account.pending'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/account-pending')
            ->where('status', $state)
        );
})->with(['pending', 'declined']);

test('a declined account still gets nothing', function () {
    $this->actingAs(User::factory()->declined()->create())
        ->get(route('dashboard'))
        ->assertRedirect(route('account.pending'));
});

test('an account waiting for approval can still log out', function () {
    $this->actingAs(User::factory()->pending()->create())
        ->post(route('logout'))
        ->assertRedirect();

    $this->assertGuest();
});

test('an approved account is sent on from the waiting page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('account.pending'))
        ->assertRedirect(route('dashboard'));
});

test('an admin can accept someone, who can then get in', function () {
    $pending = User::factory()->pending()->create();

    $this->actingAs(User::factory()->admin()->create())
        ->post(route('admin.users.approve', $pending))
        ->assertRedirect();

    $pending->refresh();

    expect($pending->status)->toBe(AccountStatus::Approved)
        ->and($pending->email_verified_at)->not->toBeNull();

    $this->actingAs($pending)->get(route('dashboard'))->assertOk();
});

test('an admin can accept someone they declined before', function () {
    $declined = User::factory()->declined()->create();

    $this->actingAs(User::factory()->admin()->create())
        ->post(route('admin.users.approve', $declined));

    expect($declined->refresh()->status)->toBe(AccountStatus::Approved);
});

test('an admin can decline someone', function () {
    $pending = User::factory()->pending()->create();

    $this->actingAs(User::factory()->admin()->create())
        ->post(route('admin.users.decline', $pending))
        ->assertRedirect();

    expect($pending->refresh()->status)->toBe(AccountStatus::Declined);
});

test('an admin cannot decline themselves', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.users.decline', $admin))
        ->assertSessionHasErrors('user');

    expect($admin->refresh()->status)->toBe(AccountStatus::Approved);
});

test('a non admin cannot accept or decline anyone', function () {
    $pending = User::factory()->pending()->create();
    $mechanic = User::factory()->create();

    $this->actingAs($mechanic)->post(route('admin.users.approve', $pending))->assertForbidden();
    $this->actingAs($mechanic)->post(route('admin.users.decline', $pending))->assertForbidden();

    expect($pending->refresh()->status)->toBe(AccountStatus::Pending);
});

test('the team page lists people waiting for approval first and admins see how many', function () {
    User::factory()->create(['name' => 'Aaron']);
    User::factory()->pending()->create(['name' => 'Zed']);

    $this->actingAs(User::factory()->admin()->create(['name' => 'Bob']))
        ->get(route('admin.users.index'))
        ->assertInertia(fn ($page) => $page
            ->where('users.0.name', 'Zed')
            ->where('users.0.status', 'pending')
            ->where('pendingAccountCount', 1)
        );
});

test('only admins are told how many people are waiting', function () {
    User::factory()->pending()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('pendingAccountCount', 0));
});

test('the make admin command approves an account waiting for approval', function () {
    $user = User::factory()->pending()->create(['email' => 'kaleb@example.com']);

    $this->artisan('app:make-admin', ['email' => 'kaleb@example.com'])->assertSuccessful();

    expect($user->refresh()->status)->toBe(AccountStatus::Approved);
});
