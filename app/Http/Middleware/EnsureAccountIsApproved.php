<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Holds a signed-in account that an administrator has not accepted, or has
 * declined, at the waiting page.
 *
 * Runs on every web request rather than being listed on each route group,
 * so a route added later can never be reached by an account nobody let in.
 */
class EnsureAccountIsApproved
{
    /**
     * The routes an account that is not approved can still use.
     *
     * @var array<int, string>
     */
    private const array ALLOWED_ROUTES = ['account.pending', 'logout'];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || $user->isApproved() || $request->routeIs(...self::ALLOWED_ROUTES)) {
            return $next($request);
        }

        abort_if($request->expectsJson(), Response::HTTP_FORBIDDEN, __('Your account is waiting for an administrator.'));

        return to_route('account.pending');
    }
}
