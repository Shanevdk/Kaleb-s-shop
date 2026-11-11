<?php

namespace App\Http\Middleware;

use App\Enums\Permission;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'role' => $request->user()?->role?->value,
                'can' => collect(Permission::cases())
                    ->mapWithKeys(fn (Permission $permission): array => [
                        Str::camel($permission->value) => (bool) $request->user()?->can($permission->value),
                    ])
                    ->all(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Counted for the admins' sidebar only, so no one else pays for the query.
            'openFeedback' => fn (): int => $request->user()?->can(Permission::ManageTeam->value)
                ? Feedback::open()->count()
                : 0,
        ];
    }
}
