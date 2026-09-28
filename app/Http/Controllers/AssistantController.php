<?php

namespace App\Http\Controllers;

use App\Actions\AskShopAssistant;
use App\Actions\Assistant\AssistantUnavailable;
use App\Http\Requests\AskAssistantRequest;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class AssistantController extends Controller
{
    /**
     * Show the shop assistant.
     */
    public function show(): Response
    {
        return Inertia::render('assistant', [
            'isConfigured' => filled(config('services.openrouter.key')),
        ]);
    }

    /**
     * Answer the latest question in the conversation.
     */
    public function ask(AskAssistantRequest $request, AskShopAssistant $assistant): JsonResponse
    {
        try {
            return response()->json($assistant->handle($request->user(), $request->conversation()));
        } catch (AssistantUnavailable $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }
    }
}
