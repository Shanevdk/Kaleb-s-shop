<?php

use App\Models\ApiKey;
use App\Models\User;
use Inertia\Support\SessionKey;

test('mechanics cannot see, make or delete api keys', function () {
    $apiKey = ApiKey::factory()->create();
    $mechanic = User::factory()->create();

    $this->actingAs($mechanic)
        ->get(route('admin.api-keys.index'))
        ->assertForbidden();

    $this->actingAs($mechanic)
        ->post(route('admin.api-keys.store'), ['name' => 'Accounting'])
        ->assertForbidden();

    $this->actingAs($mechanic)
        ->delete(route('admin.api-keys.destroy', $apiKey))
        ->assertForbidden();

    expect(ApiKey::count())->toBe(1);
});

test('an admin sees each key with who made it, but never the key itself', function () {
    $this->freezeSecond();
    $maker = User::factory()->admin()->create(['name' => 'Shane']);
    $apiKey = ApiKey::factory()
        ->for($maker)
        ->withToken('vdk_secret-key-that-must-stay-hidden-AbCd')
        ->create(['name' => 'Accounting', 'last_used_at' => now()->subHours(2)]);

    $this->actingAs($maker)
        ->get(route('admin.api-keys.index'))
        ->assertOk()
        ->assertDontSee('secret-key-that-must-stay-hidden')
        ->assertDontSee($apiKey->token_hash)
        ->assertInertia(fn ($page) => $page
            ->component('admin/api-keys/index')
            ->has('apiKeys', 1)
            ->where('apiKeys.0.id', $apiKey->id)
            ->where('apiKeys.0.name', 'Accounting')
            ->where('apiKeys.0.hint', 'vdk_…AbCd')
            ->where('apiKeys.0.made_by', 'Shane')
            ->where('apiKeys.0.last_used_ago', '2 hours ago')
            ->where('apiUrl', url('/api/v1'))
            ->has('collections', 18)
        );
});

test('an admin can make a key, which is shown once, kept only as a hash and works straight away', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.api-keys.store'), ['name' => '  Accounting  '])
        ->assertRedirect(route('admin.api-keys.index'))
        ->assertInertiaFlash('newApiKey.name', 'Accounting');

    $token = session(SessionKey::FLASH_DATA)['newApiKey']['token'];
    $apiKey = ApiKey::sole();

    expect($token)->toStartWith('vdk_')->toHaveLength(52)
        ->and($apiKey->name)->toBe('Accounting')
        ->and($apiKey->user_id)->toBe($admin->id)
        ->and($apiKey->token_hash)->toBe(hash('sha256', $token))
        ->and($apiKey->last_four)->toBe(substr($token, -4));

    $this->assertDatabaseMissing('api_keys', ['token_hash' => $token]);

    $this->withToken($token)
        ->getJson(route('api.v1.index'))
        ->assertOk();
});

test('a key needs a name', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->post(route('admin.api-keys.store'), ['name' => '  '])
        ->assertSessionHasErrors(['name' => 'The name field is required.']);

    expect(ApiKey::count())->toBe(0);
});

test('an admin can delete a key, which stops it working straight away', function () {
    $apiKey = ApiKey::factory()->withToken('vdk_about-to-be-deleted')->create(['name' => 'Reports']);

    $this->actingAs(User::factory()->admin()->create())
        ->delete(route('admin.api-keys.destroy', $apiKey))
        ->assertRedirect(route('admin.api-keys.index'))
        ->assertInertiaFlash('toast.message', "Reports can no longer read the shop's data.");

    $this->assertModelMissing($apiKey);

    $this->withToken('vdk_about-to-be-deleted')
        ->getJson(route('api.v1.index'))
        ->assertUnauthorized();
});
