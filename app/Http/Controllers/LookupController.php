<?php

namespace App\Http\Controllers;

use App\Actions\DecodeVin;
use App\Actions\FetchRecalls;
use App\Enums\MachineKind;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LookupController extends Controller
{
    /**
     * Look a machine up by VIN or serial number and show what it is, in 3D,
     * with its specs and the service and repair notes for its kind.
     */
    public function index(Request $request, DecodeVin $decoder, FetchRecalls $recalls): Response
    {
        $identifier = DecodeVin::normalise($request->string('identifier'));
        $isVin = DecodeVin::looksLikeVin($identifier);
        $specs = $isVin ? $decoder->handle($identifier) : null;

        $kind = MachineKind::tryFrom((string) $request->string('kind'))
            ?? MachineKind::tryFrom((string) ($specs['kind'] ?? ''))
            ?? MachineKind::Other;

        return Inertia::render('lookup', [
            'identifier' => $identifier,
            'is_vin' => $isVin,
            'specs' => $specs,
            'kind' => $kind->value,
            'maintenance' => $identifier !== '' ? $kind->maintenanceSchedule($specs['engine']['fuel'] ?? null) : [],
            'repairs' => $identifier !== '' ? $kind->commonRepairs() : [],
            'recalls' => Inertia::defer(fn (): array => isset($specs['make'], $specs['model'], $specs['year'])
                ? $recalls->handle($specs['make'], $specs['model'], (int) $specs['year'])
                : []),
            'kinds' => MachineKind::options(),
        ]);
    }

    /**
     * Decode a VIN for a form that wants to fill itself in.
     */
    public function decode(Request $request, DecodeVin $decoder): JsonResponse
    {
        $identifier = DecodeVin::normalise($request->string('vin'));

        return response()->json([
            'is_vin' => DecodeVin::looksLikeVin($identifier),
            'specs' => $decoder->handle($identifier),
        ]);
    }
}
