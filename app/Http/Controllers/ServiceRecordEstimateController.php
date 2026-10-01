<?php

namespace App\Http\Controllers;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\EstimateJobDuration;
use App\Http\Requests\EstimateJobDurationRequest;
use App\Models\ServiceRecord;
use Illuminate\Http\JsonResponse;

class ServiceRecordEstimateController extends Controller
{
    /**
     * Have the AI estimate how long the job will take, for the mechanic to
     * drop into the notes and edit or overwrite before saving.
     */
    public function store(EstimateJobDurationRequest $request, ServiceRecord $serviceRecord, EstimateJobDuration $estimate): JsonResponse
    {
        // The estimate keeps its own time budget; this is headroom on top so
        // PHP never cuts the answer off.
        set_time_limit(90);

        try {
            $result = $estimate->handle($serviceRecord, $request->string('notes')->toString());
        } catch (AssistantUnavailable $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        return response()->json($result);
    }
}
