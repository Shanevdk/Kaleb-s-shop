<?php

namespace App\Mail;

use App\Models\Feedback;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Feedback sent from the Feedback button, emailed to the admins the moment
 * it comes in. Replies go straight to whoever sent it. It goes out after the
 * response, so sending stays instant for them.
 */
class FeedbackMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public Feedback $feedback, public User $sender)
    {
        $this->onConnection('deferred');
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [new Address($this->sender->email, $this->sender->name)],
            subject: __('Feedback from :name', ['name' => $this->sender->name]),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'mail.feedback',
            with: [
                'pageUrl' => $this->feedback->page === null ? null : url($this->feedback->page),
                'inboxUrl' => route('admin.feedback.index'),
            ],
        );
    }
}
