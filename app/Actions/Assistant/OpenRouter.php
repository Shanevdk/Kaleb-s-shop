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
     * The fewest seconds worth giving a model; with less left in the budget
     * there is no point starting another attempt.
     */
    private const SHORTEST_ATTEMPT = 5;

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
     * A web request only gets about a minute before PHP gives up on it, so a
     * caller answering one passes a budget: the fallbacks share it, and the
     * search stops with a clear message rather than the page dying half way.
     * Asking for a low reasoning effort keeps the thinking models, which
     * otherwise spend most of their time reasoning, to seconds rather than
     * a minute.
     *
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools
     * @param  array<int, string>|null  $models  The models to try instead of the chat ones.
     * @param  'low'|'medium'|'high'|null  $reasoning  How hard a thinking model should think.
     * @param  float|null  $budget  Seconds all the attempts together may take.
     * @return array{message: array<string, mixed>, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    public function complete(array $messages, array $tools = [], int $timeout = 90, ?array $models = null, ?string $reasoning = null, ?float $budget = null): array
    {
        /** @var array{key: string, url: string, model: string, fallback_models: array<int, string>} $config */
        $config = config('services.openrouter');

        $models = array_values(array_unique(array_filter($models ?? [$config['model'], ...$config['fallback_models']])));
        $failure = 'The AI service had a problem. Try again in a moment.';
        $giveUpAt = $budget === null ? null : microtime(true) + $budget;

        foreach ($models as $model) {
            $attemptTimeout = $timeout;

            if ($giveUpAt !== null) {
                $remaining = (int) floor($giveUpAt - microtime(true));

                if ($remaining < self::SHORTEST_ATTEMPT) {
                    $failure = 'The free AI models are slow right now. Try again in a minute.';

                    break;
                }

                $attemptTimeout = min($timeout, $remaining);
            }

            try {
                $response = Http::withToken($config['key'])
                    ->withHeaders([
                        'HTTP-Referer' => config('app.url'),
                        'X-Title' => config('app.name'),
                    ])
                    ->acceptJson()
                    ->timeout($attemptTimeout)
                    ->post(rtrim($config['url'], '/').'/chat/completions', array_filter([
                        'model' => $model,
                        'messages' => $messages,
                        'tools' => $tools,
                        'reasoning' => $reasoning === null ? null : ['effort' => $reasoning],
                    ]));
            } catch (ConnectionException $exception) {
                report($exception);
                $failure = str_contains($exception->getMessage(), 'timed out')
                    ? 'The free AI models are slow right now. Try again in a minute.'
                    : 'Could not reach the AI service. Check the connection and try again.';

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
