<?php

namespace App\Http\Controllers;

use App\Enums\EquipmentServiceType;
use App\Enums\EquipmentStatus;
use App\Enums\ServiceStatus;
use App\Http\Requests\EquipmentRequest;
use App\Http\Resources\EquipmentChecklistResource;
use App\Http\Resources\EquipmentResource;
use App\Http\Resources\EquipmentServiceRecordResource;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentController extends Controller
{
    /**
     * Display every piece of equipment in the shop.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));

        $equipment = Equipment::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->whereLike('name', "%{$search}%")
                        ->orWhereLike('category', "%{$search}%")
                        ->orWhereLike('serial_number', "%{$search}%");
                });
            })
            ->withCount(['checklists', 'serviceRecords'])
            ->withSum('serviceRecords as parts_spend', 'parts_cost')
            ->withSum('serviceRecords as labour_spend', 'labour_cost')
            ->withMax('serviceRecords as last_serviced_on', 'performed_on')
            ->orderBy('name')
            ->get();

        return Inertia::render('equipment/index', [
            'equipment' => EquipmentResource::collection($equipment)->resolve(),
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Show the form for adding a piece of equipment.
     */
    public function create(): Response
    {
        return Inertia::render('equipment/create', [
            'statuses' => EquipmentStatus::options(),
        ]);
    }

    /**
     * Store a newly added piece of equipment.
     */
    public function store(EquipmentRequest $request): RedirectResponse
    {
        $equipment = $request->user()->equipment()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Equipment added.')]);

        return to_route('equipment.show', $equipment);
    }

    /**
     * Display a single piece of equipment, its checklists and its service
     * history.
     */
    public function show(Equipment $equipment): Response
    {
        Gate::authorize('view', $equipment);

        $checklists = $equipment->checklists()
            ->withCheckTallies()
            ->latest('performed_on')
            ->latest('id')
            ->get();

        $records = $equipment->serviceRecords()
            ->latest('performed_on')
            ->latest('id')
            ->get();

        return Inertia::render('equipment/show', [
            'equipment' => EquipmentResource::make($equipment)->resolve(),
            'checklists' => EquipmentChecklistResource::collection($checklists)->resolve(),
            'records' => EquipmentServiceRecordResource::collection($records)->resolve(),
            'types' => EquipmentServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'stats' => [
                'records' => $records->count(),
                'hours' => round((float) $records->sum(fn (EquipmentServiceRecord $record): float => (float) $record->hours), 2),
                'spend' => round((float) $records->sum(fn (EquipmentServiceRecord $record): float => $record->total_cost), 2),
                'open' => $records->reject(fn (EquipmentServiceRecord $record): bool => $record->status->isCompleted())->count(),
                'needs_attention' => $checklists->sum(fn (EquipmentChecklist $checklist): int => (int) $checklist->getAttribute('flagged_count')),
            ],
        ]);
    }

    /**
     * Show the form for editing a piece of equipment.
     */
    public function edit(Equipment $equipment): Response
    {
        Gate::authorize('update', $equipment);

        return Inertia::render('equipment/edit', [
            'equipment' => EquipmentResource::make($equipment)->resolve(),
            'statuses' => EquipmentStatus::options(),
        ]);
    }

    /**
     * Update the given piece of equipment.
     */
    public function update(EquipmentRequest $request, Equipment $equipment): RedirectResponse
    {
        $equipment->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Equipment updated.')]);

        return to_route('equipment.show', $equipment);
    }

    /**
     * Remove the given piece of equipment and its history.
     */
    public function destroy(Equipment $equipment): RedirectResponse
    {
        Gate::authorize('delete', $equipment);

        $equipment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Equipment removed.')]);

        return to_route('equipment.index');
    }
}
