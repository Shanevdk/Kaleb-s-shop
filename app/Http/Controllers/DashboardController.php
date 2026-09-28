<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Resources\ServiceRecordResource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the workshop overview.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $startOfMonth = now()->startOfMonth();

        $recentRecords = $user->serviceRecords()
            ->with('vehicle')
            ->latest('performed_on')
            ->latest('id')
            ->limit(6)
            ->get();

        $openRecords = $user->serviceRecords()
            ->with('vehicle')
            ->whereIn('status', [ServiceStatus::Planned, ServiceStatus::InProgress])
            ->oldest('performed_on')
            ->limit(5)
            ->get();

        return Inertia::render('dashboard', [
            'stats' => [
                'vehicles' => $user->vehicles()->count(),
                'jobs' => $user->serviceRecords()->count(),
                'jobs_this_month' => $user->serviceRecords()->where('performed_on', '>=', $startOfMonth)->count(),
                'open_jobs' => $user->serviceRecords()
                    ->whereIn('status', [ServiceStatus::Planned, ServiceStatus::InProgress])
                    ->count(),
                'hours' => round((float) $user->serviceRecords()->sum('hours'), 2),
                'spend' => round(
                    (float) $user->serviceRecords()->sum('parts_cost')
                    + (float) $user->serviceRecords()->sum('labour_cost'),
                    2,
                ),
                'spend_this_month' => round(
                    (float) $user->serviceRecords()->where('performed_on', '>=', $startOfMonth)->sum('parts_cost')
                    + (float) $user->serviceRecords()->where('performed_on', '>=', $startOfMonth)->sum('labour_cost'),
                    2,
                ),
            ],
            'recentRecords' => ServiceRecordResource::collection($recentRecords)->resolve(),
            'openRecords' => ServiceRecordResource::collection($openRecords)->resolve(),
        ]);
    }
}
