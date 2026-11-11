<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    /**
     * Display what the team has sent from the Feedback button: everything
     * still waiting on an admin, then the most recently resolved.
     */
    public function index(): Response
    {
        return Inertia::render('admin/feedback/index', [
            'open' => FeedbackResource::collection(
                Feedback::open()->with('user')->latest()->get(),
            )->resolve(),
            'resolved' => FeedbackResource::collection(
                Feedback::resolved()->with('user')->latest('resolved_at')->limit(50)->get(),
            )->resolve(),
        ]);
    }

    /**
     * Mark feedback as dealt with, or open it again.
     */
    public function update(Request $request, Feedback $feedback): RedirectResponse
    {
        $request->validate([
            'resolved' => ['required', 'boolean'],
        ]);

        $feedback->resolved_at = $request->boolean('resolved') ? now() : null;
        $feedback->save();

        return back();
    }
}
