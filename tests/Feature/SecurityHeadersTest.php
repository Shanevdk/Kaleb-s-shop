<?php

test('pages cannot be framed, sniffed or run scripts from anywhere else', function () {
    $response = $this->get(route('login'))->assertOk();

    $response->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    $policy = $response->headers->get('Content-Security-Policy');

    expect($policy)
        ->toContain("script-src 'self' 'nonce-")
        ->toContain("object-src 'none'")
        ->toContain("base-uri 'self'")
        ->toContain("frame-src 'none'")
        ->toContain("frame-ancestors 'none'");
});

test('the inline theme script carries the nonce the policy allows', function () {
    $response = $this->get(route('login'));

    preg_match("/'nonce-([^']+)'/", (string) $response->headers->get('Content-Security-Policy'), $matches);

    expect($matches[1] ?? null)->not->toBeNull()
        ->and($response->getContent())->toContain('<script nonce="'.$matches[1].'">');
});

test('the barcode scanner library is allowed to load', function () {
    config(['services.scandit.library_location' => 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@8.6.0/sdc-lib/']);

    $policy = $this->get(route('login'))->headers->get('Content-Security-Policy');

    expect($policy)
        ->toContain("'wasm-unsafe-eval' https://cdn.jsdelivr.net")
        ->toContain("worker-src 'self' blob: https://cdn.jsdelivr.net");
});

test('browsers are told to stick to https once they reach the site over it', function () {
    $this->get(route('login'))->assertHeaderMissing('Strict-Transport-Security');

    $this->get(str_replace('http://', 'https://', route('login')))
        ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
