<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Display everyone with access to the shop.
     */
    public function index(Request $request): Response
    {
        $users = User::orderBy('name')->get();

        return Inertia::render('admin/users/index', [
            'users' => UserResource::collection($users)->resolve(),
        ]);
    }

    /**
     * Show the form for adding someone to the shop.
     */
    public function create(): Response
    {
        return Inertia::render('admin/users/create');
    }

    /**
     * Add someone to the shop.
     *
     * They are marked verified on creation: there is no outbound mail
     * configured, so an unverified account could never get past the
     * `verified` middleware.
     */
    public function store(UserRequest $request): RedirectResponse
    {
        $user = new User;

        // Force filled rather than mass assigned: `is_admin` is deliberately
        // left out of the model's fillable list so it can never be set
        // straight from request input.
        $user->forceFill([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $request->validated('password'),
            'is_admin' => $request->boolean('is_admin'),
            'email_verified_at' => now(),
        ])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name can now sign in.', ['name' => $user->name]),
        ]);

        return to_route('admin.users.index');
    }

    /**
     * Grant or revoke shop administrator access.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'is_admin' => ['required', 'boolean'],
        ]);

        if ($request->user()->id === $user->id) {
            return back()->withErrors([
                'is_admin' => __('You cannot change your own access.'),
            ]);
        }

        $user->is_admin = $validated['is_admin'];
        $user->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $user->is_admin
                ? __(':name is now an administrator.', ['name' => $user->name])
                : __(':name is no longer an administrator.', ['name' => $user->name]),
        ]);

        return back();
    }

    /**
     * Remove someone's access to the shop.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->id === $user->id) {
            return back()->withErrors([
                'user' => __('You cannot remove your own account here.'),
            ]);
        }

        $user->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name no longer has access.', ['name' => $user->name]),
        ]);

        return to_route('admin.users.index');
    }
}
