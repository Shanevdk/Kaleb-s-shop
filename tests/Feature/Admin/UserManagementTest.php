<?php

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Hash;

/**
 * Create an account that can reach admin-only routes.
 */
function admin(): User
{
    return User::factory()->admin()->create(['email_verified_at' => now()]);
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

test('mechanics and shoppers cannot reach the team page', function () {
    $this->actingAs(User::factory()->create(['email_verified_at' => now()]))
        ->get(route('admin.users.index'))
        ->assertForbidden();

    $this->actingAs(User::factory()->shopper()->create(['email_verified_at' => now()]))
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
            ->has('roles', count(UserRole::cases()))
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
            'role' => 'mechanic',
        ])
        ->assertRedirect(route('admin.users.index'));

    $created = User::where('email', 'kaleb@example.com')->firstOrFail();

    expect($created->name)->toBe('Kaleb Van De Krol')
        ->and($created->role)->toBe(UserRole::Mechanic)
        ->and($created->email_verified_at)->not->toBeNull();

    $this->post(route('logout'));

    $this->post(route('login'), [
        'email' => 'kaleb@example.com',
        'password' => 'Password123!',
    ]);

    $this->assertAuthenticatedAs($created);
});

test('an admin can add someone in each role', function (string $role) {
    $this->actingAs(admin())->post(route('admin.users.store'), [
        'name' => 'New Starter',
        'email' => 'starter@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'role' => $role,
    ])->assertRedirect(route('admin.users.index'));

    expect(User::where('email', 'starter@example.com')->firstOrFail()->role)->toBe(UserRole::from($role));
})->with(['admin', 'mechanic', 'shopper']);

test('adding someone requires a name, unique email and confirmed password', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->post(route('admin.users.store'), [
            'name' => '',
            'email' => $admin->email,
            'password' => 'Password123!',
            'password_confirmation' => 'different',
            'role' => 'owner',
        ])
        ->assertSessionHasErrors(['name', 'email', 'password', 'role']);
});

test('a non admin cannot add anyone', function () {
    $this->actingAs(User::factory()->create(['email_verified_at' => now()]))
        ->post(route('admin.users.store'), [
            'name' => 'Sneaky',
            'email' => 'sneaky@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'admin',
        ])
        ->assertForbidden();

    expect(User::where('email', 'sneaky@example.com')->exists())->toBeFalse();
});

test('a role has to be picked when adding someone', function () {
    $this->actingAs(admin())
        ->post(route('admin.users.store'), [
            'name' => 'Mechanic',
            'email' => 'mechanic@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])
        ->assertSessionHasErrors('role');

    expect(User::where('email', 'mechanic@example.com')->exists())->toBeFalse();
});

test('an admin can change what someone else can do', function () {
    $admin = admin();
    $member = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $member), ['role' => 'shopper'])
        ->assertRedirect();

    expect($member->refresh()->role)->toBe(UserRole::Shopper);

    $this->actingAs($admin)->patch(route('admin.users.update', $member), ['role' => 'admin']);

    expect($member->refresh()->role)->toBe(UserRole::Admin);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $member), ['role' => 'owner'])
        ->assertSessionHasErrors('role');
});

test('an admin cannot demote themselves and get locked out', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $admin), ['role' => 'mechanic'])
        ->assertSessionHasErrors('role');

    expect($admin->refresh()->role)->toBe(UserRole::Admin);
});

test('the team page lists every permission as an option', function () {
    $this->actingAs(admin())
        ->get(route('admin.users.index'))
        ->assertInertia(fn ($page) => $page
            ->has('permissionOptions', count(Permission::cases()))
        );
});

test('an admin can grant someone a permission their role would not otherwise include', function () {
    $admin = admin();
    $shopper = User::factory()->shopper()->create(['email_verified_at' => now()]);

    expect($shopper->can('vehicles'))->toBeFalse();

    $this->actingAs($admin)
        ->patch(route('admin.users.permissions.update', $shopper), ['permissions' => ['vehicles']])
        ->assertRedirect();

    $shopper->refresh();

    expect($shopper->permissions)->toBe(['vehicles'])
        ->and($shopper->can('vehicles'))->toBeTrue();

    $this->actingAs($shopper)->get(route('vehicles.index'))->assertOk();
});

test('taking a permission back off an account leaves its role alone', function () {
    $admin = admin();
    $shopper = User::factory()->shopper()->create(['email_verified_at' => now(), 'permissions' => ['vehicles']]);

    $this->actingAs($admin)
        ->patch(route('admin.users.permissions.update', $shopper), ['permissions' => []])
        ->assertRedirect();

    $shopper->refresh();

    expect($shopper->permissions)->toBe([])
        ->and($shopper->can('vehicles'))->toBeFalse()
        ->and($shopper->can('shopping-list'))->toBeTrue();
});

test('permissions sent to update must be real permissions', function () {
    $admin = admin();
    $member = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($admin)
        ->patch(route('admin.users.permissions.update', $member), ['permissions' => ['not-a-real-page']])
        ->assertSessionHasErrors('permissions.0');

    expect($member->refresh()->permissions)->toBeNull();
});

test('a non admin cannot change anyone else\'s permissions', function () {
    $member = User::factory()->create(['email_verified_at' => now()]);
    $shopper = User::factory()->shopper()->create(['email_verified_at' => now()]);

    $this->actingAs($shopper)
        ->patch(route('admin.users.permissions.update', $member), ['permissions' => ['vehicles']])
        ->assertForbidden();

    expect($member->refresh()->permissions)->toBeNull();
});

test('guests cannot change anyone\'s permissions', function () {
    $member = User::factory()->create(['email_verified_at' => now()]);

    $this->patch(route('admin.users.permissions.update', $member), ['permissions' => ['vehicles']])
        ->assertRedirect(route('login'));
});

test('an admin can remove someone else while what they logged stays with the shop', function () {
    $admin = admin();
    $member = User::factory()->create(['email_verified_at' => now()]);
    $vehicle = Vehicle::factory()->for($member)->create();

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $member))
        ->assertRedirect(route('admin.users.index'));

    expect(User::find($member->id))->toBeNull()
        ->and($vehicle->fresh())->not->toBeNull()
        ->and($vehicle->fresh()->user_id)->toBeNull();
});

test('an admin cannot delete their own account from the team page', function () {
    $admin = admin();

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $admin))
        ->assertSessionHasErrors('user');

    expect(User::find($admin->id))->not->toBeNull();
});

test('an admin can let an unverified account in', function () {
    $stranded = User::factory()->create(['email_verified_at' => null]);

    $this->actingAs(admin())
        ->post(route('admin.users.verify', $stranded))
        ->assertRedirect();

    expect($stranded->refresh()->email_verified_at)->not->toBeNull();
});

test('a non admin cannot verify anyone', function () {
    $stranded = User::factory()->create(['email_verified_at' => null]);

    $this->actingAs(User::factory()->create(['email_verified_at' => now()]))
        ->post(route('admin.users.verify', $stranded))
        ->assertForbidden();

    expect($stranded->refresh()->email_verified_at)->toBeNull();
});

test('verifying someone already verified leaves their original timestamp alone', function () {
    $verifiedAt = now()->subMonth();
    $member = User::factory()->create(['email_verified_at' => $verifiedAt]);

    $this->actingAs(admin())->post(route('admin.users.verify', $member));

    expect($member->refresh()->email_verified_at->timestamp)->toBe($verifiedAt->timestamp);
});

test('the verify account command lets a stranded account in', function () {
    $user = User::factory()->create(['email' => 'kaleb@example.com', 'email_verified_at' => null]);

    $this->artisan('app:verify-account', ['email' => 'kaleb@example.com'])->assertSuccessful();

    expect($user->refresh()->email_verified_at)->not->toBeNull()
        ->and($user->role)->toBe(UserRole::Mechanic);
});

test('the verify account command reports an unknown email', function () {
    $this->artisan('app:verify-account', ['email' => 'nobody@example.com'])->assertFailed();
});

test('the make admin command promotes and verifies an account', function () {
    $user = User::factory()->create(['email' => 'owner@example.com', 'email_verified_at' => null]);

    $this->artisan('app:make-admin', ['email' => 'owner@example.com'])->assertSuccessful();

    expect($user->refresh()->role)->toBe(UserRole::Admin)
        ->and($user->email_verified_at)->not->toBeNull();
});

test('the make admin command can revoke access', function () {
    $user = admin();

    $this->artisan('app:make-admin', ['email' => $user->email, '--revoke' => true])->assertSuccessful();

    expect($user->refresh()->role)->toBe(UserRole::Mechanic);
});

test('the make admin command reports an unknown email', function () {
    $this->artisan('app:make-admin', ['email' => 'nobody@example.com'])->assertFailed();
});

test('the create admin command makes a verified admin from the configured defaults', function () {
    config(['app.admin' => ['name' => 'Shop Owner', 'email' => 'Owner@Example.com', 'password' => 'golfcart']]);

    $this->artisan('app:create-admin')->assertSuccessful();

    $user = User::where('email', 'owner@example.com')->sole();

    expect($user->name)->toBe('Shop Owner')
        ->and($user->role)->toBe(UserRole::Admin)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('golfcart', $user->password))->toBeTrue();
});

test('the create admin command resets an existing account instead of duplicating it', function () {
    $user = User::factory()->create(['email' => 'owner@example.com', 'name' => 'Kept Name']);

    $this->artisan('app:create-admin', ['email' => 'owner@example.com', '--password' => 'new-password'])
        ->assertSuccessful();

    $user->refresh();

    expect(User::where('email', 'owner@example.com')->count())->toBe(1)
        ->and($user->name)->toBe('Kept Name')
        ->and($user->role)->toBe(UserRole::Admin)
        ->and(Hash::check('new-password', $user->password))->toBeTrue();
});

test('the create admin command fails without a password', function () {
    config(['app.admin.password' => null]);

    $this->artisan('app:create-admin', ['email' => 'owner@example.com'])->assertFailed();

    expect(User::where('email', 'owner@example.com')->exists())->toBeFalse();
});

test('the delete admin command removes the configured admin after confirming', function () {
    $user = admin();
    config(['app.admin.email' => $user->email]);

    $this->artisan('app:delete-admin')
        ->expectsConfirmation("Delete {$user->email}? What it logged stays with the shop.", 'yes')
        ->assertSuccessful();

    expect(User::whereKey($user->id)->exists())->toBeFalse();
});

test('the delete admin command keeps the account when not confirmed', function () {
    $user = admin();

    $this->artisan('app:delete-admin', ['email' => $user->email])
        ->expectsConfirmation("Delete {$user->email}? What it logged stays with the shop.", 'no')
        ->assertSuccessful();

    expect(User::whereKey($user->id)->exists())->toBeTrue();
});

test('the delete admin command will not delete someone who is not an admin', function () {
    $user = User::factory()->create();

    $this->artisan('app:delete-admin', ['email' => $user->email, '--force' => true])->assertFailed();

    expect(User::whereKey($user->id)->exists())->toBeTrue();
});

test('the delete admin command reports an unknown email', function () {
    $this->artisan('app:delete-admin', ['email' => 'nobody@example.com', '--force' => true])->assertFailed();
});
