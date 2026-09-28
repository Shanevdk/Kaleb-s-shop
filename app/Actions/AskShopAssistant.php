<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\ShopTools;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class AskShopAssistant
{
    /**
     * How many rounds of looking things up one answer may take.
     */
    private const MAX_STEPS = 8;

    /**
     * Answer the latest question in the conversation, letting the model look
     * up the user's records as often as it needs to.
     *
     * @param  array<int, array{role: string, content: string}>  $conversation
     * @return array{reply: string, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    public function handle(User $user, array $conversation): array
    {
        if (blank(config('services.openrouter.key'))) {
            throw new AssistantUnavailable('The assistant is not set up yet. Add an OPENROUTER_API_KEY to the environment.');
        }

        $tools = new ShopTools($user);
        $definitions = $tools->definitions();
        $messages = [['role' => 'system', 'content' => $this->instructions($user)], ...$conversation];

        for ($step = 0; $step < self::MAX_STEPS; $step++) {
            ['message' => $message, 'model' => $model] = $this->complete($messages, $definitions);

            /** @var array<int, array{id: string, function: array{name: string, arguments?: string}}> $calls */
            $calls = $message['tool_calls'] ?? [];

            if ($calls === []) {
                $reply = trim((string) ($message['content'] ?? ''));

                return [
                    'reply' => $reply !== '' ? $reply : 'Sorry, I could not come up with an answer to that. Try asking it another way.',
                    'model' => $model,
                ];
            }

            $messages[] = ['role' => 'assistant', 'content' => $message['content'] ?? null, 'tool_calls' => $calls];

            foreach ($calls as $call) {
                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $call['id'],
                    'content' => json_encode($this->run($tools, $call['function']), JSON_THROW_ON_ERROR),
                ];
            }
        }

        return [
            'reply' => 'That took more looking up than I can do in one go. Try asking something narrower.',
            'model' => null,
        ];
    }

    /**
     * Run one tool call, turning arguments the model mangled into an error it
     * can read and correct.
     *
     * @param  array{name: string, arguments?: string}  $function
     * @return array<mixed>
     */
    private function run(ShopTools $tools, array $function): array
    {
        $raw = trim($function['arguments'] ?? '');
        $arguments = $raw === '' ? [] : json_decode($raw, true);

        if (! is_array($arguments)) {
            return ['error' => 'The arguments were not valid JSON.'];
        }

        return $tools->call($function['name'], $arguments);
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
    private function complete(array $messages, array $tools): array
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
                    ->timeout(90)
                    ->post(rtrim($config['url'], '/').'/chat/completions', [
                        'model' => $model,
                        'messages' => $messages,
                        'tools' => $tools,
                    ]);
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

    /**
     * Tell the model who it is working for and how to behave.
     */
    private function instructions(User $user): string
    {
        $shop = config('app.name');
        $today = now()->format('l j F Y');

        return <<<PROMPT
        You are the workshop assistant inside {$shop}, the app a small mechanic workshop uses to track its vehicles and machines, service jobs, inspection checklists and parts inventory. Today is {$today}. You are helping {$user->name}.

        Look up the real records with your tools before answering anything about this shop's vehicles, jobs, checklists, parts or stock. Never guess or invent records, figures, part numbers or dates. If the tools do not have it, say so plainly. When a question names a vehicle, find its id with list_vehicles first.

        You can only read records. You cannot create, change or delete anything, so when asked to, say where in the app to do it: Vehicles, Service records, Checklists, Inventory, Scan or Shopping list.

        You can also answer general mechanical questions (service intervals, fluids, diagnosis, common faults) from general knowledge. Say when an answer is general guidance rather than from the shop's records, and point to the manufacturer's manual for torque specs and anything safety critical.

        Keep answers short and practical for someone standing in a workshop. Write plain text with short lists, no tables and no markdown headings. Money is in the shop's own currency; write amounts as plain numbers with two decimals.
        PROMPT;
    }
}
