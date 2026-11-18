<?php

namespace App\Actions;

use App\Enums\ApiCollection;
use App\Http\Resources\Api\V1\RecordResource;
use Carbon\CarbonInterface;
use Generator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Everything the shop shares with other apps, in one shape whether an app
 * reads it with an API key or an admin downloads it from the API keys page.
 */
class ExportShopData
{
    /**
     * Gather every collection, each read a few hundred records at a time as
     * it is sent, so a large shop does not run the server out of memory.
     * With a time, only records made or changed since then go out.
     *
     * @return array{exported_at: string, collections: array<string, Generator<int, array<string, mixed>>>}
     */
    public function everything(?CarbonInterface $updatedSince = null): array
    {
        $collections = [];

        foreach (ApiCollection::cases() as $collection) {
            $collections[$collection->value] = $this->stream($collection, $updatedSince);
        }

        return [
            'exported_at' => now()->toIso8601String(),
            'collections' => $collections,
        ];
    }

    /**
     * Start a query for a collection's records, keeping only those changed
     * since the given time when there is one.
     *
     * @return Builder<Model>
     */
    public function query(ApiCollection $collection, ?CarbonInterface $updatedSince = null): Builder
    {
        return $collection->model()::query()
            ->when($updatedSince, fn (Builder $query) => $query->where('updated_at', '>=', $updatedSince));
    }

    /**
     * Read a collection's records a few hundred at a time, ready to send.
     *
     * @return Generator<int, array<string, mixed>>
     */
    private function stream(ApiCollection $collection, ?CarbonInterface $updatedSince): Generator
    {
        foreach ($this->query($collection, $updatedSince)->lazyById(500) as $record) {
            yield (new RecordResource($record))->resolve();
        }
    }
}
