<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PendingAccountController extends Controller
{
    /**
     * Show someone who signed themselves up that an administrator still has
     * to accept them, or that they were declined.
     */
    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user->isApproved()) {
            return to_route('dashboard');
        }

        return Inertia::render('auth/account-pending', [
            'status' => $user->status->value,
        ]);
    }
}
