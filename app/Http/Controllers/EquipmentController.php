<?php

namespace App\Http\Controllers;

use App\Enums\EquipmentDivision;
use App\Enums\EquipmentServiceType;
use App\Enums\EquipmentStatus;
use App\Enums\ServiceStatus;
use App\Http\Requests\EquipmentBarcodeRequest;
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
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentController extends Controller
{
    /**
     * Display every piece of equipment in the division.
     */
    public function index(Request $request, EquipmentDivision $division): Response
    {
        $search = trim((string) $request->string('search'));

        $equipment = Equipment::query()
            ->inDivision($division)
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
            'division' => $division->value,
            'equipment' => EquipmentResource::collection($equipment)->resolve(),
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Show the form for adding a piece of equipment to the division.
     */
    public function create(EquipmentDivision $division): Response
    {
        return Inertia::render('equipment/create', [
            'division' => $division->value,
            'statuses' => EquipmentStatus::options(),
        ]);
    }

    /**
     * Store a piece of equipment newly added to the division.
     */
    public function store(EquipmentRequest $request, EquipmentDivision $division): RedirectResponse
    {
        $equipment = $request->user()->equipment()->create([
            ...$request->validated(),
            'division' => $division,
        ]);

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
            ->get()
            ->each->setRelation('equipment', $equipment);

        $equipment->load('defaultChecklist');

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
     * Bring up the equipment a scanned QR code, barcode or serial number
     * belongs to. A machine in a division the user cannot see is treated
     * as not found.
     */
    public function scan(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:255'],
        ]);

        $code = trim($validated['barcode']);
        $equipment = Equipment::findByCode($code);

        if ($equipment === null || $request->user()->cannot('view', $equipment)) {
            throw ValidationException::withMessages([
                'barcode' => __('No equipment scans as :code. Assign it from the machine\'s page first.', ['code' => $code]),
            ]);
        }

        return to_route('equipment.show', $equipment);
    }

    /**
     * Point a scanned QR code or barcode at the given piece of equipment,
     * replacing any it had.
     */
    public function assignBarcode(EquipmentBarcodeRequest $request, Equipment $equipment): RedirectResponse
    {
        $equipment->update(['barcode' => $request->validated('barcode')]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Code assigned to :name.', ['name' => $equipment->name]),
        ]);

        return back();
    }

    /**
     * Remove the given piece of equipment and its history.
     */
    public function destroy(Equipment $equipment): RedirectResponse
    {
        Gate::authorize('delete', $equipment);

        $equipment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Equipment removed.')]);

        return to_route($equipment->division->routeName('equipment.index'));
    }
}
