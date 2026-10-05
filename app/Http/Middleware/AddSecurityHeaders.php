<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    /**
     * How long browsers remember to only use HTTPS: a year.
     */
    private const HSTS_MAX_AGE = 31536000;

    /**
     * Add the security headers to every response: no framing, no content
     * type sniffing, HTTPS only, and a content security policy that only
     * runs the app's own scripts.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        Vite::useCspNonce();

        $response = $next($request);

        $headers = [
            'X-Frame-Options' => 'DENY',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ];

        if ($request->isSecure() || app()->isProduction()) {
            $headers['Strict-Transport-Security'] = 'max-age='.self::HSTS_MAX_AGE.'; includeSubDomains';
        }

        // Laravel's debug error page runs inline scripts of its own.
        if (! (config('app.debug') && $response->getStatusCode() >= 500)) {
            $headers['Content-Security-Policy'] = $this->contentSecurityPolicy();
        }

        foreach ($headers as $name => $value) {
            if (! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }

        return $response;
    }

    /**
     * Build the policy. Scripts only come from the app itself (and the Vite
     * dev server while it runs), inline ones only with this request's nonce.
     * The barcode scanner loads its engine from a CDN as WebAssembly and
     * runs it in a worker, so that origin, WebAssembly and blob workers are
     * allowed too.
     */
    private function contentSecurityPolicy(): string
    {
        $scriptSources = array_unique(array_filter([
            "'self'",
            "'nonce-".Vite::cspNonce()."'",
            "'wasm-unsafe-eval'",
            $this->originOf(config('app.asset_url')),
            $this->originOf(config('services.scandit.library_location')),
            $this->viteDevServer(),
        ]));

        $workerSources = array_unique(array_filter([
            "'self'",
            'blob:',
            $this->originOf(config('services.scandit.library_location')),
        ]));

        return implode('; ', [
            'script-src '.implode(' ', $scriptSources),
            'worker-src '.implode(' ', $workerSources),
            "object-src 'none'",
            "base-uri 'self'",
            "frame-src 'none'",
            "frame-ancestors 'none'",
        ]);
    }

    /**
     * The Vite dev server's origin while `npm run dev` is running.
     */
    private function viteDevServer(): ?string
    {
        $hotFile = Vite::hotFile();

        return File::exists($hotFile) ? $this->originOf(trim(File::get($hotFile))) : null;
    }

    /**
     * Get the scheme, host and port of a URL, or null if it has none.
     */
    private function originOf(mixed $url): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }

        $parts = parse_url($url);

        if (! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        return $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
    }
}
