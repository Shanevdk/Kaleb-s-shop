<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
            'roles' => UserRole::options(),
            'permissionOptions' => Permission::options(),
        ]);
    }

    /**
     * Show the form for adding someone to the shop.
     */
    public function create(): Response
    {
        return Inertia::render('admin/users/create', [
            'roles' => UserRole::options(),
        ]);
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

        // Force filled rather than mass assigned: `role` is deliberately left
        // out of the model's fillable list so it can never be set straight
        // from request input.
        $user->forceFill([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $request->validated('password'),
            'role' => $request->enum('role', UserRole::class),
            'email_verified_at' => now(),
        ])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name can now sign in.', ['name' => $user->name]),
        ]);

        return to_route('admin.users.index');
    }

    /**
     * Change what someone on the team can do.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        if ($request->user()->id === $user->id) {
            return back()->withErrors([
                'role' => __('You cannot change your own access.'),
            ]);
        }

        $user->role = $request->enum('role', UserRole::class);
        $user->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name is now a :role.', ['name' => $user->name, 'role' => strtolower($user->role->label())]),
        ]);

        return back();
    }

    /**
     * Add or remove permissions on someone's account individually, on top
     * of whatever their role already grants them.
     */
    public function updatePermissions(Request $request, User $user): RedirectResponse
    {
        $request->validate([
            'permissions' => ['array'],
            'permissions.*' => [Rule::enum(Permission::class)],
        ]);

        $user->permissions = $request->input('permissions', []);
        $user->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(":name's permissions were updated.", ['name' => $user->name]),
        ]);

        return back();
    }

    /**
     * Mark someone as verified by hand.
     *
     * Accounts created before the shop closed public sign-up are stuck
     * behind the `verified` middleware with no mail configured to let them
     * out, so an administrator vouches for them here instead.
     */
    public function verify(User $user): RedirectResponse
    {
        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name can now sign in.', ['name' => $user->name]),
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
