<?php

namespace App\Http\Controllers;

use App\Enums\ChecklistTemplate;
use App\Enums\CheckStatus;
use App\Http\Requests\InspectionRequest;
use App\Http\Resources\InspectionResource;
use App\Models\Inspection;
use App\Models\Vehicle;
use App\Models\VehicleChecklistChange;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class InspectionController extends Controller
{
    /**
     * Display every checklist the user has run.
     */
    public function index(Request $request): Response
    {
        $vehicleId = (string) $request->string('vehicle');

        if (! Str::isUlid($vehicleId)) {
            $vehicleId = '';
        }

        $inspections = Inspection::query()
            ->with('vehicle')
            ->withCheckTallies()
            ->when($vehicleId !== '', fn ($query) => $query->where('vehicle_id', $vehicleId))
            ->latest('performed_on')
            ->latest('id')
            ->get();

        return Inertia::render('inspections/index', [
            'inspections' => InspectionResource::collection($inspections)->resolve(),
            'vehicles' => $this->vehicleOptions($request),
            'filters' => ['vehicle' => $vehicleId],
        ]);
    }

    /**
     * Show the vehicle and checklist picker.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('inspections/create', [
            'vehicles' => $this->vehicleOptions($request),
            'templates' => ChecklistTemplate::catalog(),
            'selectedVehicle' => (string) $request->string('vehicle'),
            'selectedTemplate' => ChecklistTemplate::tryFrom((string) $request->string('template'))?->value,
            'checklistChanges' => $this->checklistChanges(),
        ]);
    }

    /**
     * Start a checklist and build its items from the chosen template.
     */
    public function store(InspectionRequest $request): RedirectResponse
    {
        $template = ChecklistTemplate::from($request->validated('template'));

        $inspection = $request->user()->inspections()->create([
            ...$request->validated(),
            'title' => $template->label(),
        ]);

        $inspection->fillFromTemplate();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist started.')]);

        return to_route('inspections.show', $inspection);
    }

    /**
     * Display a checklist and everything left to check.
     */
    public function show(Inspection $inspection): Response
    {
        Gate::authorize('view', $inspection);

        $inspection->load(['vehicle', 'items.repairJob.parts.inventoryItem']);

        return Inertia::render('inspections/show', [
            'inspection' => InspectionResource::make($inspection)->resolve(),
            'statuses' => CheckStatus::options(),
            'vehicleChanges' => $inspection->vehicleChanges(),
        ]);
    }

    /**
     * Update the checklist notes or sign it off.
     */
    public function update(Request $request, Inspection $inspection): RedirectResponse
    {
        Gate::authorize('update', $inspection);

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'completed' => ['required', 'boolean'],
        ]);

        $inspection->update([
            'notes' => $validated['notes'] ?? null,
            'completed_at' => $validated['completed'] ? now() : null,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $validated['completed'] ? __('Checklist signed off.') : __('Checklist reopened.'),
        ]);

        return back();
    }

    /**
     * Remove the given checklist.
     */
    public function destroy(Inspection $inspection): RedirectResponse
    {
        Gate::authorize('delete', $inspection);

        $inspection->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checklist removed.')]);

        return to_route('inspections.index');
    }

    /**
     * Get what has been added to and left out of each vehicle's copies of the
     * checklists, keyed by vehicle and then by checklist.
     *
     * @return array<string, array<string, array{added: array<int, array{section: string, label: string}>, removed: array<int, array{section: string, label: string}>}>>
     */
    private function checklistChanges(): array
    {
        return VehicleChecklistChange::query()
            ->oldest()
            ->oldest('id')
            ->get()
            ->groupBy('vehicle_id')
            ->map(fn (EloquentCollection $changes): array => $changes
                ->groupBy(fn (VehicleChecklistChange $change): string => $change->template->value)
                ->map(fn (EloquentCollection $forChecklist, string $template): array => VehicleChecklistChange::describe(
                    $forChecklist,
                    ChecklistTemplate::from($template),
                ))
                ->all())
            ->all();
    }

    /**
     * Get the vehicles owned by the current user as select options.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function vehicleOptions(Request $request): array
    {
        return Vehicle::query()
            ->orderBy('make')
            ->orderBy('model')
            ->get()
            ->map(fn ($vehicle): array => [
                'value' => (string) $vehicle->id,
                'label' => $vehicle->display_name,
            ])
            ->all();
    }
}
