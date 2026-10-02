<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Resources\ServiceRecordResource;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the workshop overview.
     *
     * Only Kaleb's Shop has this overview as its home page. Equipment-only
     * accounts land on the equipment list, schedulers on the schedule, and
     * everyone else on the shopping list.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        if (Gate::denies('mechanics-shop')) {
            if (Gate::allows('equipment')) {
                return to_route('equipment.index');
            }

            return Gate::allows('schedule')
                ? to_route('schedule.index')
                : to_route('shopping-list.index');
        }

        $startOfMonth = now()->startOfMonth();

        $recentRecords = ServiceRecord::query()
            ->with('vehicle')
            ->latest('performed_on')
            ->latest('id')
            ->limit(6)
            ->get();

        $openRecords = ServiceRecord::query()
            ->with('vehicle')
            ->whereIn('status', [ServiceStatus::Planned, ServiceStatus::InProgress])
            ->oldest('performed_on')
            ->limit(5)
            ->get();

        return Inertia::render('dashboard', [
            'stats' => [
                'vehicles' => Vehicle::count(),
                'jobs' => ServiceRecord::count(),
                'jobs_this_month' => ServiceRecord::where('performed_on', '>=', $startOfMonth)->count(),
                'open_jobs' => ServiceRecord::query()
                    ->whereIn('status', [ServiceStatus::Planned, ServiceStatus::InProgress])
                    ->count(),
                'hours' => round((float) ServiceRecord::sum('hours'), 2),
                'spend' => round(
                    (float) ServiceRecord::sum('parts_cost') + (float) ServiceRecord::sum('labour_cost'),
                    2,
                ),
                'spend_this_month' => round(
                    (float) ServiceRecord::where('performed_on', '>=', $startOfMonth)->sum('parts_cost')
                    + (float) ServiceRecord::where('performed_on', '>=', $startOfMonth)->sum('labour_cost'),
                    2,
                ),
            ],
            'recentRecords' => ServiceRecordResource::collection($recentRecords)->resolve(),
            'openRecords' => ServiceRecordResource::collection($openRecords)->resolve(),
        ]);
    }
}
