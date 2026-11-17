<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ApiCollection;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\RecordResource;
use Carbon\CarbonInterface;
use Generator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedJsonResponse;

/**
 * The shop's data, read-only, for another app holding an API key.
 */
class DataController extends Controller
{
    /**
     * List every collection, how many records it holds and where to read
     * it, so an app can find its way around.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (ApiCollection $collection): array => [
                'name' => $collection->value,
                'count' => $collection->model()::query()->count(),
                'url' => route('api.v1.records.index', $collection),
            ], ApiCollection::cases()),
            'export_url' => route('api.v1.export'),
        ]);
    }

    /**
     * Send every collection in one response, streamed as it is read so a
     * large shop does not run the server out of memory. With updated_since,
     * only records made or changed since then are sent.
     */
    public function export(Request $request): StreamedJsonResponse
    {
        $request->validate([
            'updated_since' => ['nullable', 'date'],
        ]);

        $updatedSince = $this->updatedSince($request);

        $collections = [];

        foreach (ApiCollection::cases() as $collection) {
            $collections[$collection->value] = $this->stream($collection, $updatedSince);
        }

        return response()->streamJson([
            'exported_at' => now()->toIso8601String(),
            'collections' => $collections,
        ]);
    }

    /**
     * Page through one collection, oldest first. Follow links.next until it
     * is null. With updated_since, only records made or changed since then
     * are listed.
     */
    public function records(Request $request, ApiCollection $collection): AnonymousResourceCollection
    {
        $request->validate([
            'updated_since' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        return RecordResource::collection(
            $this->query($collection, $this->updatedSince($request))
                ->orderBy('id')
                ->cursorPaginate($request->integer('per_page', 100))
                ->withQueryString(),
        );
    }

    /**
     * Show one record.
     */
    public function record(ApiCollection $collection, string $id): RecordResource
    {
        return new RecordResource($collection->model()::query()->findOrFail($id));
    }

    /**
     * Get the time asked for with updated_since, once validated, on the
     * shop's clock, which is how times are kept in the database.
     */
    private function updatedSince(Request $request): ?CarbonInterface
    {
        return $request->date('updated_since')?->setTimezone((string) config('app.timezone'));
    }

    /**
     * Start a query for a collection's records, keeping only those changed
     * since the given time when there is one.
     *
     * @return Builder<Model>
     */
    private function query(ApiCollection $collection, ?CarbonInterface $updatedSince): Builder
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
