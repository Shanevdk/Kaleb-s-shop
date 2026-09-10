<?php

namespace App\Http\Controllers;

use App\Enums\ServiceStatus;
use App\Http\Resources\ServiceRecordResource;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\Relation;
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
                'hours' => round($this->sumOf($user->serviceRecords(), 'hours'), 2),
                'spend' => round(
                    $this->sumOf($user->serviceRecords(), 'parts_cost')
                    + $this->sumOf($user->serviceRecords(), 'labour_cost'),
                    2,
                ),
                'spend_this_month' => round(
                    $this->sumOf($user->serviceRecords()->where('performed_on', '>=', $startOfMonth), 'parts_cost')
                    + $this->sumOf($user->serviceRecords()->where('performed_on', '>=', $startOfMonth), 'labour_cost'),
                    2,
                ),
            ],
            'recentRecords' => ServiceRecordResource::collection($recentRecords)->resolve(),
            'openRecords' => ServiceRecordResource::collection($openRecords)->resolve(),
        ]);
    }

    /**
     * Sum a decimal column. MongoDB adds the values up into a BSON Decimal128,
     * which has to go through its string form to become a float.
     *
     * @param  Relation<covariant \Illuminate\Database\Eloquent\Model, User, *>  $query
     */
    private function sumOf(Relation $query, string $column): float
    {
        return (float) (string) $query->sum($column);
    }
}
