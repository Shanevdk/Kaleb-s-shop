<?php

use App\Models\User;

/**
 * Create an account that can reach admin-only routes.
 */
function admin(): User
{
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->is_admin = true;
    $user->save();

    return $user;
}

test('public registration is switched off', function () {
    expect(Route::has('register'))->toBeFalse()
        ->and(Route::has('register.store'))->toBeFalse();

    $this->post('/register', [
        'name' => 'Walk In',
        'email' => 'walkin@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertNotFound();

    expect(User::where('email', 'walkin@example.com')->exists())->toBeFalse();
});

test('guests cannot reach the team page', function () {
    $this->get(route('admin.users.index'))->assertRedirect(route('login'));
});

test('a non admin cannot reach the team page', function () {
    $this->actingAs(User::factory()->create(['email_verified_at' => now()]))
        ->get(route('admin.users.index'))
        ->assertForbidden();
});

test('an admin sees everyone on the team page', function () {
    $admin = admin();
    User::factory()->create(['name' => 'Kaleb', 'email_verified_at' => now()]);

    $this->actingAs($admin)
        ->get(route('admin.users.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/users/index')
            ->has('users', 2)
        );
});

test('an admin can add someone who can sign in immediately', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->post(route('admin.users.store'), [
            'name' => 'Kaleb Van De Krol',
            'email' => 'kaleb@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])
        ->assertRedirect(route('admin.users.index'));

    $created = User::where('email', 'kaleb@example.com')->firstOrFail();

    expect($created->name)->toBe('Kaleb Van De Krol')
        ->and((bool) $created->is_admin)->toBeFalse()
        ->and($created->email_verified_at)->not->toBeNull();

    $this->post(route('logout'));

    $this->post(route('login'), [
        'email' => 'kaleb@example.com',
        'password' => 'Password123!',
    ]);

    $this->assertAuthenticatedAs($created);
});

test('an admin can add another admin', function () {
    $this->actingAs(admin())->post(route('admin.users.store'), [
        'name' => 'Second Admin',
        'email' => 'second@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'is_admin' => true,
    ]);

    expect((bool) User::where('email', 'second@example.com')->firstOrFail()->is_admin)->toBeTrue();
});

test('adding someone requires a name, unique email and confirmed password', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->post(route('admin.users.store'), [
            'name' => '',
            'email' => $admin->email,
            'password' => 'Password123!',
            'password_confirmation' => 'different',
        ])
        ->assertSessionHasErrors(['name', 'email', 'password']);
});

test('a non admin cannot add anyone', function () {
    $this->actingAs(User::factory()->create(['email_verified_at' => now()]))
        ->post(route('admin.users.store'), [
            'name' => 'Sneaky',
            'email' => 'sneaky@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])
        ->assertForbidden();

    expect(User::where('email', 'sneaky@example.com')->exists())->toBeFalse();
});

test('a new account cannot be made admin through mass assignment', function () {
    $this->actingAs(admin())->post(route('admin.users.store'), [
        'name' => 'Mechanic',
        'email' => 'mechanic@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'is_admin' => false,
    ]);

    expect((bool) User::where('email', 'mechanic@example.com')->firstOrFail()->is_admin)->toBeFalse();
});

test('an admin can promote and demote someone else', function () {
    $admin = admin();
    $member = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $member), ['is_admin' => true])
        ->assertRedirect();

    expect((bool) $member->refresh()->is_admin)->toBeTrue();

    $this->actingAs($admin)->patch(route('admin.users.update', $member), ['is_admin' => false]);

    expect((bool) $member->refresh()->is_admin)->toBeFalse();
});

test('an admin cannot demote themselves and get locked out', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $admin), ['is_admin' => false])
        ->assertSessionHasErrors('is_admin');

    expect((bool) $admin->refresh()->is_admin)->toBeTrue();
});

test('an admin can remove someone else', function () {
    $admin = admin();
    $member = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $member))
        ->assertRedirect(route('admin.users.index'));

    expect(User::find($member->id))->toBeNull();
});

test('an admin cannot delete their own account from the team page', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $admin))
        ->assertSessionHasErrors('user');

    expect(User::find($admin->id))->not->toBeNull();
});

test('the make admin command promotes and verifies an account', function () {
    $user = User::factory()->create(['email' => 'owner@example.com', 'email_verified_at' => null]);

    $this->artisan('app:make-admin', ['email' => 'owner@example.com'])->assertSuccessful();

    expect((bool) $user->refresh()->is_admin)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull();
});

test('the make admin command can revoke access', function () {
    $user = admin();

    $this->artisan('app:make-admin', ['email' => $user->email, '--revoke' => true])->assertSuccessful();

    expect((bool) $user->refresh()->is_admin)->toBeFalse();
});

test('the make admin command reports an unknown email', function () {
    $this->artisan('app:make-admin', ['email' => 'nobody@example.com'])->assertFailed();
});
