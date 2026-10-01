<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Models\Inspection;
use App\Models\ServiceRecord;
use Illuminate\Http\JsonResponse;

class ScreenSaverDataController extends Controller
{
    /**
     * A light summary of today's jobs and any checklist still open, for the
     * screen saver's schedule and checklist panels to poll.
     */
    public function index(): JsonResponse
    {
        $today = today();

        $jobs = ServiceRecord::query()
            ->with('vehicle')
            ->whereDate('performed_on', $today)
            ->where('status', '!=', ServiceStatus::Completed)
            ->orderBy('performed_on')
            ->get()
            ->map(fn (ServiceRecord $job): array => [
                'id' => $job->id,
                'title' => $job->title,
                'status' => $job->status->value,
                'vehicle' => $job->vehicle?->display_name,
            ])
            ->values();

        $checklists = Inspection::query()
            ->withCheckTallies()
            ->with('vehicle')
            ->whereNull('completed_at')
            ->latest('performed_on')
            ->limit(10)
            ->get()
            ->map(fn (Inspection $inspection): array => [
                'id' => $inspection->id,
                'title' => $inspection->template->label(),
                'vehicle' => $inspection->vehicle?->display_name,
                'itemsCount' => $inspection->items_count,
                'checkedCount' => $inspection->checked_count,
                'flaggedCount' => $inspection->flagged_count,
            ])
            ->values();

        return response()->json([
            'date' => $today->toDateString(),
            'jobsToday' => $jobs,
            'checklistsInProgress' => $checklists,
        ]);
    }
}
