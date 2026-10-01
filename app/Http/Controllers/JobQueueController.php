<?php

namespace App\Http\Controllers;

use App\Actions\SyncServiceRecordStock;
use App\Enums\ServiceStatus;
use App\Http\Resources\ServiceRecordResource;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class JobQueueController extends Controller
{
    /**
     * How many days a completed job stays on the board before it drops off,
     * so the queue does not fill up with old finished work.
     */
    private const RECENT_COMPLETED_DAYS = 14;

    public function __construct(private SyncServiceRecordStock $syncServiceRecordStock) {}

    /**
     * Display the job queue: every job not yet done, plus what was finished
     * recently, so it can be worked through as a board.
     */
    public function index(): Response
    {
        $jobs = ServiceRecord::query()
            ->with(['vehicle', 'parts.inventoryItem'])
            ->where(fn ($query) => $query
                ->where('status', '!=', ServiceStatus::Completed)
                ->orWhere('performed_on', '>=', today()->subDays(self::RECENT_COMPLETED_DAYS)))
            ->orderBy('performed_on')
            ->orderBy('created_at')
            ->get();

        return Inertia::render('job-queue/index', [
            'jobs' => ServiceRecordResource::collection($jobs)->resolve(),
        ]);
    }

    /**
     * Move a job to another column on the board.
     */
    public function update(Request $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        Gate::authorize('update', $serviceRecord);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(ServiceStatus::class)],
        ]);

        $serviceRecord->update($validated);

        $short = $this->syncServiceRecordStock->handle($serviceRecord);

        if ($short === []) {
            Inertia::flash('toast', ['type' => 'success', 'message' => __(':title moved to :status.', [
                'title' => $serviceRecord->title,
                'status' => $serviceRecord->status->label(),
            ])]);

            return back();
        }

        Inertia::flash('toast', [
            'type' => 'warning',
            'message' => __('Moved, but there was not enough :parts on the shelf. The shortfall is on the shopping list.', [
                'parts' => implode(', ', $short),
            ]),
        ]);

        return back();
    }
}
