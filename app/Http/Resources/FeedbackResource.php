<?php

namespace App\Http\Resources;

use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Feedback
 */
class FeedbackResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'message' => $this->message,
            'page' => $this->page,
            'sender' => $this->user === null ? null : [
                'name' => $this->user->name,
                'email' => $this->user->email,
            ],
            'sent_at' => $this->created_at?->format('D j M Y, g:i a'),
            'sent_ago' => $this->created_at?->diffForHumans(),
            'is_resolved' => $this->resolved_at !== null,
        ];
    }
}
