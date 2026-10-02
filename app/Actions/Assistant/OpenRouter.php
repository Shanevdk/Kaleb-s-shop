<?php

namespace App\Actions\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

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
     * The most calls the whole shop may send in a minute. Saving jobs and
     * flagging checklist items each ask the AI something, so without a cap
     * one busy afternoon could use up the free requests everyone shares and
     * leave the assistant, diagnosis and estimates with nothing.
     */
    public const CALLS_PER_MINUTE = 30;

    /**
     * The rate limiter key the shop's calls are counted under.
     */
    public const RATE_LIMIT_KEY = 'openrouter-calls';

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
     * The whole shop shares a cap on calls a minute. Past it nothing is sent,
     * and the caller hears the AI is busy, the same as any other failure.
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

            $this->countCall();

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

    /**
     * Count a call against the shop's allowance for the minute, or throw
     * without sending it when the allowance is used up. Every model tried
     * counts, since each one is a request against the free quota.
     *
     * @throws AssistantUnavailable
     */
    private function countCall(): void
    {
        if (RateLimiter::tooManyAttempts(self::RATE_LIMIT_KEY, self::CALLS_PER_MINUTE)) {
            throw new AssistantUnavailable('The AI is busy with a lot of requests right now. Try again in a minute.');
        }

        RateLimiter::hit(self::RATE_LIMIT_KEY, 60);
    }
}
