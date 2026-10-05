<?php

namespace App\Http\Controllers;

use App\Actions\DiagnoseProblem;
use App\Enums\MachineKind;
use App\Http\Requests\DiagnoseRequest;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class DiagnosisController extends Controller
{
    /**
     * Show the problem form.
     */
    public function show(): Response
    {
        return Inertia::render('diagnose', [
            'isConfigured' => filled(config('services.openrouter.key')),
            'kinds' => MachineKind::options(),
            'vehicles' => Vehicle::query()
                ->alphabetical()
                ->get()
                ->map(fn (Vehicle $vehicle): array => [
                    'id' => $vehicle->id,
                    'display_name' => $vehicle->display_name,
                    'registration' => $vehicle->registration,
                    'kind' => $vehicle->machineKind()->value,
                    'make' => $vehicle->make,
                    'model' => $vehicle->model,
                    'year' => $vehicle->year,
                    'engine' => $vehicle->engine_summary,
                    'odometer' => $vehicle->odometer,
                ])
                ->all(),
        ]);
    }

    /**
     * Diagnose the problem that was described.
     */
    public function diagnose(DiagnoseRequest $request, DiagnoseProblem $diagnoseProblem): JsonResponse
    {
        // The diagnosis keeps its own time budget; this is headroom on top
        // so PHP never cuts the answer off.
        set_time_limit(90);

        $vehicleId = $request->validated('vehicle_id');

        return response()->json($diagnoseProblem->handle(
            $request->safe()->except('vehicle_id'),
            $vehicleId === null ? null : Vehicle::query()->findOrFail($vehicleId),
            $request->user(),
        ));
    }
}
