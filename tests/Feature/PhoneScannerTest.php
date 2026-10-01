<?php

use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;

beforeEach(function () {
    Http::preventStrayRequests();

    // A running dev server would otherwise be asked to pre-render the page.
    config(['inertia.ssr.enabled' => false]);
});

/**
 * Pair a phone for the given user, returning the pairing the computer got.
 *
 * @return array{token: string, url: string, qr: string, expires_at: string}
 */
function pairPhone(User $user): array
{
    return test()->actingAs($user)
        ->postJson(route('phone-scanner.store'))
        ->assertOk()
        ->json();
}

/**
 * Get the signed address the phone posts its scans to.
 */
function phoneScanUrl(string $token): string
{
    return URL::temporarySignedRoute('phone-scanner.scan', now()->addMinutes(30), ['token' => $token]);
}

test('guests and shoppers cannot pair a phone', function () {
    $this->postJson(route('phone-scanner.store'))->assertUnauthorized();

    $this->actingAs(User::factory()->shopper()->create())
        ->postJson(route('phone-scanner.store'))
        ->assertForbidden();
});

test('pairing a phone hands back a QR code for a signed link', function () {
    $pairing = pairPhone(User::factory()->create());

    expect($pairing['qr'])->toStartWith('data:image/svg+xml;base64,')
        ->and($pairing['url'])->toContain('signature=')
        ->and($pairing['url'])->toContain($pairing['token']);
});

test('the phone opens the scanner from the link without logging in, and the computer sees it connect', function () {
    $user = User::factory()->create();
    $pairing = pairPhone($user);
    auth()->logout();

    $this->withoutVite()
        ->get($pairing['url'])
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('phone-scanner')
            ->where('expired', false)
            ->where('scanUrl', fn (string $url): bool => str_contains($url, 'signature='))
            ->has('scanner.license_key')
        );

    $this->actingAs($user)
        ->getJson(route('phone-scanner.poll', $pairing['token']))
        ->assertJson(['expired' => false, 'connected' => true, 'scans' => []]);
});

test('a link that has been tampered with is refused', function () {
    $pairing = pairPhone(User::factory()->create());

    $this->get(route('phone-scanner.show', $pairing['token']))->assertForbidden();
    $this->postJson(route('phone-scanner.scan', $pairing['token']), ['barcode' => '111'])->assertForbidden();
});

test('a code scanned on the phone is decoded and turns up on the computer', function () {
    $user = User::factory()->create();
    $filter = InventoryItem::factory()->create(['name' => 'Engine air filter', 'barcode' => '111222']);
    $pairing = pairPhone($user);
    auth()->logout();

    $this->postJson(phoneScanUrl($pairing['token']), ['barcode' => '111222'])
        ->assertOk()
        ->assertJson(['id' => 1, 'barcode' => '111222', 'description' => 'Engine air filter', 'inventory_item_id' => $filter->id]);
    $this->postJson(phoneScanUrl($pairing['token']), ['barcode' => 'SHELF-A1'])
        ->assertOk()
        ->assertJson(['id' => 2, 'description' => null]);

    $this->actingAs($user)
        ->getJson(route('phone-scanner.poll', ['token' => $pairing['token'], 'after' => 1]))
        ->assertOk()
        ->assertJsonCount(1, 'scans')
        ->assertJsonPath('scans.0.barcode', 'SHELF-A1');
});

test('the phone has to send a code', function () {
    $pairing = pairPhone(User::factory()->create());

    $this->postJson(phoneScanUrl($pairing['token']), ['barcode' => ''])
        ->assertJsonValidationErrors('barcode');
});

test('someone else cannot read what another person paired phone scanned', function () {
    $pairing = pairPhone(User::factory()->create());

    $this->actingAs(User::factory()->create())
        ->getJson(route('phone-scanner.poll', $pairing['token']))
        ->assertNotFound();
});

test('once a pairing runs out the phone and the computer are both told', function () {
    $user = User::factory()->create();
    $pairing = pairPhone($user);
    Cache::forget("phone-scanner:{$pairing['token']}");

    $this->postJson(phoneScanUrl($pairing['token']), ['barcode' => '111'])
        ->assertStatus(410);

    $this->withoutVite()
        ->get($pairing['url'])
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('expired', true)->where('scanUrl', null));

    $this->actingAs($user)
        ->getJson(route('phone-scanner.poll', $pairing['token']))
        ->assertJson(['expired' => true]);
});
