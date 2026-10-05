<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Models\Inspection;
use App\Models\ServiceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScreenSaverDataController extends Controller
{
    /**
     * A light summary of today's jobs and any checklist still open, for the
     * screen saver's schedule and checklist panels to poll.
     *
     * The screen saver itself is open to everyone signed in, but a shopper
     * has no business seeing the day's jobs or checklists, so each panel is
     * only filled in for someone who could otherwise open that page.
     */
    public function index(Request $request): JsonResponse
    {
        $today = today();
        $user = $request->user();

        $jobs = $user->can('schedule')
            ? ServiceRecord::query()
                ->with('vehicle')
                ->bookedBetween($today->toDateString(), $today->toDateString())
                ->where('status', '!=', ServiceStatus::Completed)
                ->orderBy('performed_on')
                ->get()
                ->filter(fn (ServiceRecord $job): bool => in_array($today->toDateString(), $job->days(), true))
                ->map(fn (ServiceRecord $job): array => [
                    'id' => $job->id,
                    'title' => $job->title,
                    'status' => $job->status->value,
                    'vehicle' => $job->vehicle?->display_name,
                ])
                ->values()
            : collect();

        $checklists = $user->can('inspections')
            ? Inspection::query()
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
                ->values()
            : collect();

        return response()->json([
            'date' => $today->toDateString(),
            'jobsToday' => $jobs,
            'checklistsInProgress' => $checklists,
        ]);
    }
}
