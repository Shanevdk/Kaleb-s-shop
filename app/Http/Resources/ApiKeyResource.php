<?php

namespace App\Http\Resources;

use App\Models\ApiKey;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ApiKey
 */
class ApiKeyResource extends JsonResource
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
            'name' => $this->name,
            'hint' => ApiKey::PREFIX.'…'.$this->last_four,
            'made_by' => $this->user?->name,
            'made_at' => $this->created_at?->format('D j M Y'),
            'last_used_ago' => $this->last_used_at?->diffForHumans(),
        ];
    }
}
