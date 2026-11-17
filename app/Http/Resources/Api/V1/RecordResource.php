<?php

namespace App\Http\Resources\Api\V1;

use App\Enums\ApiCollection;
use App\Models\Equipment;
use App\Models\InventoryItem;
use App\Models\Vehicle;
use BackedEnum;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Any record shared with another app: its id, the fields its collection
 * shares, links to its photos and when it was made and last changed. Plain
 * dates go out as YYYY-MM-DD and times as ISO 8601 with the shop's offset.
 *
 * @property Model $resource
 */
class RecordResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $fields = ApiCollection::forRecord($this->resource)->fields();

        return [
            'id' => $this->resource->getKey(),
            ...array_combine($fields, array_map($this->value(...), $fields)),
            ...$this->photoLinks(),
            'created_at' => $this->value('created_at'),
            'updated_at' => $this->value('updated_at'),
        ];
    }

    /**
     * Get a field ready to send, with dates and enums written out.
     */
    private function value(string $field): mixed
    {
        $value = $this->resource->getAttribute($field);

        return match (true) {
            $value instanceof CarbonInterface && $this->resource->hasCast($field, ['date', 'immutable_date']) => $value->toDateString(),
            $value instanceof CarbonInterface => $value->toIso8601String(),
            $value instanceof BackedEnum => $value->value,
            default => $value,
        };
    }

    /**
     * Get links to the record's photos, for the records that have them.
     *
     * @return array<string, mixed>
     */
    private function photoLinks(): array
    {
        return match (true) {
            $this->resource instanceof Vehicle => ['photo_urls' => (object) $this->resource->photoUrls()],
            $this->resource instanceof Equipment => ['photo_urls' => array_column($this->resource->photoList(), 'url')],
            $this->resource instanceof InventoryItem => ['image_url' => $this->resource->imageUrl()],
            default => [],
        };
    }
}
