<?php

namespace App\Mail;

use App\Http\Resources\WorkOrderResource;
use App\Models\ServiceRecord;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A job's work order, emailed to whoever needs to know: what is wrong, what
 * it should cost and how long it should take, with the link to the full
 * sheet. Replies go to whoever sent it.
 */
class WorkOrderMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public ServiceRecord $serviceRecord,
        public User $sender,
        public string $note = '',
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $vehicle = $this->serviceRecord->vehicle;

        return new Envelope(
            replyTo: [new Address($this->sender->email, $this->sender->name)],
            subject: $vehicle === null
                ? __('Work order: :title', ['title' => $this->serviceRecord->title])
                : __('Work order: :title, :vehicle', [
                    'title' => $this->serviceRecord->title,
                    'vehicle' => "{$vehicle->year} {$vehicle->make} {$vehicle->model}",
                ]),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'mail.work-order',
            with: [
                'sheet' => WorkOrderResource::make($this->serviceRecord)->resolve(),
                'url' => $this->serviceRecord->workOrderUrl(),
            ],
        );
    }
}
