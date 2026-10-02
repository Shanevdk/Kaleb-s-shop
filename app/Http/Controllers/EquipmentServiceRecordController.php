<?php

namespace App\Http\Controllers;

use App\Enums\EquipmentServiceType;
use App\Enums\ServiceStatus;
use App\Http\Resources\EquipmentServiceRecordResource;
use App\Models\Equipment;
use App\Models\EquipmentServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EquipmentServiceRecordController extends Controller
{
    /**
     * Display every service record logged against any piece of equipment.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));
        $status = (string) $request->string('status');
        $equipmentId = (string) $request->string('equipment');

        if ($equipmentId !== '' && ! Equipment::query()->whereKey($equipmentId)->exists()) {
            $equipmentId = '';
        }

        if (! ServiceStatus::tryFrom($status) instanceof ServiceStatus) {
            $status = '';
        }

        $records = EquipmentServiceRecord::query()
            ->with('equipment')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->whereLike('title', "%{$search}%")
                        ->orWhereLike('description', "%{$search}%");
                });
            })
            ->when(ServiceStatus::tryFrom($status), fn ($query, ServiceStatus $status) => $query->where('status', $status))
            ->when($equipmentId !== '', fn ($query) => $query->where('equipment_id', $equipmentId))
            ->latest('performed_on')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('equipment-service-records/index', [
            'records' => EquipmentServiceRecordResource::collection($records->getCollection())->resolve(),
            'pagination' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'total' => $records->total(),
                'prev_page_url' => $records->previousPageUrl(),
                'next_page_url' => $records->nextPageUrl(),
            ],
            'equipment' => $this->equipmentOptions(),
            'types' => EquipmentServiceType::options(),
            'statuses' => ServiceStatus::options(),
            'filters' => [
                'search' => $search,
                'status' => $status,
                'equipment' => $equipmentId,
            ],
        ]);
    }

    /**
     * Log a new service record against a piece of equipment.
     */
    public function store(Request $request, Equipment $equipment): RedirectResponse
    {
        Gate::authorize('update', $equipment);

        $validated = $this->validated($request);

        $request->user()->equipmentServiceRecords()->create([
            ...$validated,
            'equipment_id' => $equipment->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Service record logged.')]);

        return back();
    }

    /**
     * Update the given service record.
     */
    public function update(Request $request, EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        Gate::authorize('update', $equipmentServiceRecord);

        $equipmentServiceRecord->update($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Service record updated.')]);

        return back();
    }

    /**
     * Remove the given service record.
     */
    public function destroy(EquipmentServiceRecord $equipmentServiceRecord): RedirectResponse
    {
        Gate::authorize('delete', $equipmentServiceRecord);

        $equipmentServiceRecord->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Service record removed.')]);

        return back();
    }

    /**
     * Get the validated attributes for a service record.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $request->merge([
            'hours' => $request->input('hours') ?: 0,
            'parts_cost' => $request->input('parts_cost') ?: 0,
            'labour_cost' => $request->input('labour_cost') ?: 0,
        ]);

        return $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(EquipmentServiceType::class)],
            'status' => ['required', Rule::enum(ServiceStatus::class)],
            'performed_on' => ['required', 'date'],
            'hours' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'parts_cost' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'labour_cost' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /**
     * Get every piece of equipment as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function equipmentOptions(): array
    {
        return Equipment::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Equipment $equipment): array => [
                'value' => $equipment->id,
                'label' => $equipment->name,
            ])
            ->all();
    }
}
