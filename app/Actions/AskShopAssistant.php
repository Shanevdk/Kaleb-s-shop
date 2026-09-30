<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\OpenRouter;
use App\Actions\Assistant\ShopTools;
use App\Models\User;

class AskShopAssistant
{
    /**
     * How many rounds of looking things up one answer may take.
     */
    private const MAX_STEPS = 8;

    /**
     * Seconds one answer may take, every look-up included, so it comes back
     * inside the minute a web request is allowed.
     */
    private const BUDGET = 55;

    /**
     * The fewest seconds worth starting another round with.
     */
    private const SHORTEST_STEP = 8;

    public function __construct(private OpenRouter $openRouter) {}

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
        $this->openRouter->ensureConfigured();

        $tools = new ShopTools;
        $definitions = $tools->definitions();
        $messages = [['role' => 'system', 'content' => $this->instructions($user)], ...$conversation];

        $giveUpAt = microtime(true) + self::BUDGET;

        for ($step = 0; $step < self::MAX_STEPS; $step++) {
            $remaining = $giveUpAt - microtime(true);

            if ($remaining < self::SHORTEST_STEP) {
                return [
                    'reply' => 'The free AI models are slow right now and that took too long to look up. Try again in a minute, or ask something narrower.',
                    'model' => null,
                ];
            }

            ['message' => $message, 'model' => $model] = $this->openRouter->complete(
                $messages,
                $definitions,
                timeout: 40,
                reasoning: 'low',
                budget: $remaining,
            );

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
