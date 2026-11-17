<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ApiCollection;
use App\Http\Controllers\Controller;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApiKeyController extends Controller
{
    /**
     * Display the keys other apps read the shop's data with, and how to use
     * them.
     */
    public function index(): Response
    {
        return Inertia::render('admin/api-keys/index', [
            'apiKeys' => ApiKeyResource::collection(
                ApiKey::query()->with('user')->latest()->get(),
            )->resolve(),
            'apiUrl' => route('api.v1.index'),
            'collections' => array_column(ApiCollection::cases(), 'value'),
        ]);
    }

    /**
     * Make a key for another app. The key itself is flashed back to show
     * once: only its hash is kept.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:80'],
        ]);

        [$apiKey, $token] = ApiKey::generate($request->string('name')->trim()->value(), $request->user());

        Inertia::flash('newApiKey', [
            'name' => $apiKey->name,
            'token' => $token,
        ]);

        return to_route('admin.api-keys.index');
    }

    /**
     * Delete a key, so the app using it can no longer read anything.
     */
    public function destroy(ApiKey $apiKey): RedirectResponse
    {
        $apiKey->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name can no longer read the shop\'s data.', ['name' => $apiKey->name]),
        ]);

        return to_route('admin.api-keys.index');
    }
}
