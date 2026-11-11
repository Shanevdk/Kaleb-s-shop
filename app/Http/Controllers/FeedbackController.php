<?php

namespace App\Http\Controllers;

use App\Mail\FeedbackMail;
use App\Models\Feedback;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class FeedbackController extends Controller
{
    /**
     * Send a problem or idea to the admins. It is kept for them on the
     * Feedback page and emailed to each of them, so they can reply to the
     * sender straight away.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'page' => ['nullable', 'string', 'max:2048', 'regex:/^\/\S*$/'],
        ]);

        $feedback = new Feedback($validated);
        $feedback->user()->associate($request->user());
        $feedback->save();

        $recipients = Feedback::recipients();

        if ($recipients->isNotEmpty()) {
            Mail::to($recipients)->send(new FeedbackMail($feedback, $request->user()));
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Thanks, the admins have it. They will reply to :email.', ['email' => $request->user()->email]),
        ]);

        return back();
    }
}
