<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Let a request through only when it carries an API key an admin made, sent
 * as "Authorization: Bearer <key>". Nobody is signed in: the key itself is
 * what is allowed in, and a deleted key stops working on its next request.
 */
class AuthenticateApiKey
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $apiKey = $token === null ? null : ApiKey::findByToken($token);

        if ($apiKey === null) {
            return response()->json(
                ['message' => 'Send a valid API key as "Authorization: Bearer <key>".'],
                Response::HTTP_UNAUTHORIZED,
                ['WWW-Authenticate' => 'Bearer'],
            );
        }

        $apiKey->markAsUsed();

        return $next($request);
    }
}
