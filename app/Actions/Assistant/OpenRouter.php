<?php

namespace App\Actions\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Talks to the free models on OpenRouter, working down the fallback list
 * until one of them answers.
 */
class OpenRouter
{
    /**
     * Throw unless an API key has been set.
     *
     * @throws AssistantUnavailable
     */
    public function ensureConfigured(): void
    {
        if (blank(config('services.openrouter.key'))) {
            throw new AssistantUnavailable('The assistant is not set up yet. Add an OPENROUTER_API_KEY to the environment.');
        }
    }

    /**
     * Send the conversation to each model in turn until one answers.
     *
     * OpenRouter cannot fall back by itself once it has started replying: it
     * sends padding to hold the connection open while the model works, so a
     * free provider that is overloaded mid-answer comes back as a 200 with an
     * error in the body. Trying the next model here covers that as well as
     * outages and rate limits.
     *
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools
     * @return array{message: array<string, mixed>, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    public function complete(array $messages, array $tools = [], int $timeout = 90): array
    {
        /** @var array{key: string, url: string, model: string, fallback_models: array<int, string>} $config */
        $config = config('services.openrouter');

        $models = array_values(array_unique(array_filter([$config['model'], ...$config['fallback_models']])));
        $failure = 'The AI service had a problem. Try again in a moment.';

        foreach ($models as $model) {
            try {
                $response = Http::withToken($config['key'])
                    ->withHeaders([
                        'HTTP-Referer' => config('app.url'),
                        'X-Title' => config('app.name'),
                    ])
                    ->acceptJson()
                    ->timeout($timeout)
                    ->post(rtrim($config['url'], '/').'/chat/completions', array_filter([
                        'model' => $model,
                        'messages' => $messages,
                        'tools' => $tools,
                    ]));
            } catch (ConnectionException $exception) {
                report($exception);
                $failure = 'Could not reach the AI service. Check the connection and try again.';

                continue;
            }

            $status = $response->status();

            // Only a bad key fails every model alike; a 402 or 403 is about
            // this model alone, so the next one may still answer.
            if ($status === 401) {
                throw new AssistantUnavailable('The OpenRouter API key was rejected. Check OPENROUTER_API_KEY.');
            }

            $message = $response->json('choices.0.message');

            if ($response->successful() && is_array($message)) {
                return ['message' => $message, 'model' => $response->json('model') ?? $model];
            }

            if ($status === 429) {
                $failure = 'The free AI models are busy or out of free requests for today. Try again later.';

                continue;
            }

            report(new AssistantUnavailable("OpenRouter model [{$model}] failed with status {$status}: ".trim($response->body())));
            $failure = 'The free AI models are overloaded right now. Try again in a minute.';
        }

        throw new AssistantUnavailable($failure);
    }
}
