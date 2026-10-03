<?php

namespace App\Http\Controllers;

use App\Actions\SyncServiceRecordStock;
use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Http\Resources\ServiceRecordResource;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'vehicles' => Vehicle::options(),
        ]);
    }

    /**
     * Quickly add a job straight to the queue with just the basics. It
     * lands as planned work, the same as one logged in full, so it can be
     * filled in with parts, hours and cost later from the service log.
     *
     * Needs the service log permission as well as the queue's, since moving
     * the job afterwards and filling it in both need it too.
     */
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', ServiceRecord::class);

        $validated = $request->validate([
            'vehicle_id' => ['required', 'string', Rule::exists('vehicles', 'id')],
            'title' => ['required', 'string', 'max:120'],
            'type' => ['nullable', Rule::enum(ServiceType::class)],
        ]);

        $request->user()->serviceRecords()->create([
            ...$validated,
            'type' => $validated['type'] ?? ServiceType::Other,
            'status' => ServiceStatus::Planned,
            'performed_on' => today(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Job added to the queue.')]);

        return back();
    }

    /**
     * Move a job to another column on the board.
     *
     * The new column and the stock it moves are saved together, so a job is
     * never left completed without having taken its parts.
     */
    public function update(Request $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        Gate::authorize('update', $serviceRecord);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(ServiceStatus::class)],
        ]);

        $short = DB::transaction(function () use ($request, $serviceRecord, $validated): array {
            $serviceRecord->update($validated);

            return $this->syncServiceRecordStock->handle($serviceRecord, $request->user());
        });

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
