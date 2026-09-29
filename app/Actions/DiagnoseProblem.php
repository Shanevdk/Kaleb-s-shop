<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\OpenRouter;
use App\Enums\MachineKind;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Support\Str;

class DiagnoseProblem
{
    /**
     * Words that say nothing about the fault, left out when matching the
     * symptoms against the common repairs.
     *
     * @var array<int, string>
     */
    private const FILLER = [
        'about', 'after', 'again', 'also', 'been', 'being', 'does', 'doing', 'from', 'have', 'into',
        'just', 'only', 'some', 'sometimes', 'still', 'that', 'then', 'there', 'they', 'this', 'very',
        'when', 'while', 'with', 'will', 'would', 'makes', 'making', 'goes', 'going', 'seems',
    ];

    public function __construct(private OpenRouter $openRouter, private FetchRecalls $fetchRecalls) {}

    /**
     * Work out what is most likely wrong with a machine from what it is doing.
     *
     * The AI diagnosis is general guidance from a free model, so the shop's own
     * common repairs for that kind of machine and the maker's recalls come back
     * alongside it, and still come back when the AI cannot answer.
     *
     * @param  array{kind?: string|null, make?: string|null, model?: string|null, year?: int|null, engine?: string|null, odometer?: int|null, codes?: string|null, symptoms: string, conditions?: string|null}  $details
     * @return array<string, mixed>
     */
    public function handle(array $details, ?Vehicle $vehicle = null): array
    {
        $machine = $this->describeMachine($details, $vehicle);

        $result = [
            'machine' => [
                'title' => trim("{$machine['year']} {$machine['make']} {$machine['model']}"),
                'kind' => $machine['kind']->value,
                'kind_label' => $machine['kind']->label(),
            ],
            'diagnosis' => null,
            'reply' => null,
            'model' => null,
            'error' => null,
            'common_repairs' => $this->matchingRepairs($machine['kind'], $details['symptoms'].' '.($details['codes'] ?? '')),
            'recalls' => $machine['year'] !== null
                ? array_slice($this->fetchRecalls->handle($machine['make'], $machine['model'], $machine['year']), 0, 10)
                : [],
        ];

        try {
            $this->openRouter->ensureConfigured();

            ['message' => $message, 'model' => $model] = $this->openRouter->complete([
                ['role' => 'system', 'content' => $this->instructions()],
                ['role' => 'user', 'content' => $this->brief($machine, $details)],
            ]);
        } catch (AssistantUnavailable $exception) {
            return [...$result, 'error' => $exception->getMessage()];
        }

        $content = trim((string) ($message['content'] ?? ''));
        $diagnosis = $this->parse($content);

        return [
            ...$result,
            'diagnosis' => $diagnosis,
            'reply' => $diagnosis === null && $content !== '' ? $content : null,
            'model' => $model,
            'error' => $diagnosis === null && $content === '' ? __('The AI came back empty. Try again in a moment.') : null,
        ];
    }

    /**
     * Put together what is known about the machine: a shop vehicle's own
     * details, with anything typed in taking over.
     *
     * @param  array<string, mixed>  $details
     * @return array{kind: MachineKind, make: string, model: string, year: int|null, engine: string|null, odometer: int|null, history: array<int, string>}
     */
    private function describeMachine(array $details, ?Vehicle $vehicle): array
    {
        $history = $vehicle === null ? [] : $vehicle->serviceRecords()
            ->latest('performed_on')
            ->limit(8)
            ->get()
            ->map(fn (ServiceRecord $record): string => trim(sprintf(
                '%s: %s (%s)%s',
                $record->performed_on->format('Y-m-d'),
                $record->title,
                $record->type->value,
                $record->odometer !== null ? " at {$record->odometer}" : '',
            )))
            ->all();

        return [
            'kind' => MachineKind::tryFrom((string) ($details['kind'] ?? '')) ?? $vehicle?->machineKind() ?? MachineKind::Other,
            'make' => trim((string) (($details['make'] ?? null) ?: $vehicle?->make)),
            'model' => trim((string) (($details['model'] ?? null) ?: $vehicle?->model)),
            'year' => isset($details['year']) ? (int) $details['year'] : $vehicle?->year,
            'engine' => ($details['engine'] ?? null) ?: $vehicle?->engine_summary,
            'odometer' => isset($details['odometer']) ? (int) $details['odometer'] : $vehicle?->odometer,
            'history' => $history,
        ];
    }

    /**
     * Pick the common repairs for this kind of machine that share words with
     * the symptoms, best match first, or all of them when none do.
     *
     * @return array<int, array{symptom: string, causes: array<int, string>, fix: string}>
     */
    private function matchingRepairs(MachineKind $kind, string $symptoms): array
    {
        $repairs = $kind->commonRepairs();

        // Compare word stems so "overheating" finds "Overheating" and
        // "misfiring" finds "misfire".
        $stems = collect(preg_split('/[^a-z0-9]+/', Str::lower($symptoms)) ?: [])
            ->filter(fn (string $word): bool => strlen($word) >= 4 && ! in_array($word, self::FILLER, true))
            ->map(fn (string $word): string => substr($word, 0, 5))
            ->unique();

        $scored = collect($repairs)
            ->map(function (array $repair) use ($stems): array {
                $haystack = Str::lower($repair['symptom'].' '.implode(' ', $repair['causes']));

                return [$repair, $stems->filter(fn (string $stem): bool => str_contains($haystack, $stem))->count()];
            })
            ->filter(fn (array $pair): bool => $pair[1] > 0)
            ->sortByDesc(fn (array $pair): int => $pair[1])
            ->map(fn (array $pair): array => $pair[0])
            ->values()
            ->all();

        return $scored !== [] ? $scored : $repairs;
    }

    /**
     * Tell the model how to diagnose and how to answer.
     */
    private function instructions(): string
    {
        return <<<'PROMPT'
        You are a senior diagnostic technician helping a mechanic in a small workshop work out what is wrong with a vehicle or machine. Think like a good diagnostician: use the exact make, model, year and engine to bring up the faults that model is known for, read any fault codes precisely, and order the causes from most to least likely. Put cheap, quick checks before expensive ones, and never suggest replacing parts without a test that confirms the fault first.

        Answer with ONLY a JSON object, no prose before or after and no markdown fences, in exactly this shape:
        {
          "summary": "One or two sentences on what is most likely going on.",
          "causes": [
            {
              "cause": "Short name of the fault",
              "likelihood": "high" | "medium" | "low",
              "why": "Why it fits these symptoms on this model, including any known pattern failure.",
              "checks": ["Step by step tests that confirm or rule it out, with expected readings where useful"],
              "fix": "The repair once confirmed.",
              "parts": ["Generic part names the repair may need, e.g. Ignition coil"]
            }
          ],
          "first_steps": ["What to do first, in order"],
          "safety": ["Anything unsafe to drive or work on, or empty"],
          "questions": ["What else to find out that would narrow it down"]
        }

        Give three to six causes. Do not invent technical service bulletin numbers, part numbers or torque figures; say to check the workshop manual for specifications. If the description is too thin to go on, still give the most likely causes and use "questions" to ask for what is missing.
        PROMPT;
    }

    /**
     * Describe the machine and the fault for the model.
     *
     * @param  array{kind: MachineKind, make: string, model: string, year: int|null, engine: string|null, odometer: int|null, history: array<int, string>}  $machine
     * @param  array<string, mixed>  $details
     */
    private function brief(array $machine, array $details): string
    {
        $lines = [
            'Machine: '.trim("{$machine['year']} {$machine['make']} {$machine['model']}")." ({$machine['kind']->label()})",
            $machine['engine'] ? "Engine: {$machine['engine']}" : null,
            $machine['odometer'] !== null ? "Odometer or hours: {$machine['odometer']}" : null,
            filled($details['codes'] ?? null) ? "Fault codes: {$details['codes']}" : 'Fault codes: none read',
            "Symptoms: {$details['symptoms']}",
            filled($details['conditions'] ?? null) ? "When it happens: {$details['conditions']}" : null,
            $machine['history'] !== [] ? "Recent work on it:\n- ".implode("\n- ", $machine['history']) : null,
        ];

        return implode("\n", array_filter($lines));
    }

    /**
     * Read the model's JSON answer, forgiving the fences and chatter free
     * models like to wrap it in. Null when there is no usable diagnosis.
     *
     * @return array{summary: string, causes: array<int, array<string, mixed>>, first_steps: array<int, string>, safety: array<int, string>, questions: array<int, string>}|null
     */
    private function parse(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $data = json_decode(substr($content, $start, $end - $start + 1), true);

        if (! is_array($data)) {
            return null;
        }

        $causes = collect(is_array($data['causes'] ?? null) ? $data['causes'] : [])
            ->filter(fn (mixed $cause): bool => is_array($cause) && filled($cause['cause'] ?? null))
            ->take(6)
            ->map(fn (array $cause): array => [
                'cause' => $this->text($cause['cause']),
                'likelihood' => in_array($cause['likelihood'] ?? null, ['high', 'medium', 'low'], true) ? $cause['likelihood'] : 'medium',
                'why' => $this->text($cause['why'] ?? null),
                'checks' => $this->list($cause['checks'] ?? null, 8),
                'fix' => $this->text($cause['fix'] ?? null),
                'parts' => array_map(fn (string $part): array => [
                    'name' => $part,
                    'in_stock' => $this->stockedPart($part),
                ], $this->list($cause['parts'] ?? null, 6)),
            ])
            ->values()
            ->all();

        $summary = $this->text($data['summary'] ?? null);

        if ($causes === [] && $summary === '') {
            return null;
        }

        return [
            'summary' => $summary,
            'causes' => $causes,
            'first_steps' => $this->list($data['first_steps'] ?? null, 8),
            'safety' => $this->list($data['safety'] ?? null, 5),
            'questions' => $this->list($data['questions'] ?? null, 5),
        ];
    }

    /**
     * Find a part on the shelves that goes by the name the model gave it.
     *
     * @return array{id: string, name: string, quantity: string}|null
     */
    private function stockedPart(string $name): ?array
    {
        $item = InventoryItem::query()->whereLike('name', "%{$name}%")->orderBy('name')->first();

        return $item === null ? null : [
            'id' => $item->id,
            'name' => $item->name,
            'quantity' => $item->formattedQuantity(),
        ];
    }

    /**
     * Get a trimmed piece of text from the model's answer.
     */
    private function text(mixed $value): string
    {
        return is_scalar($value) ? Str::limit(trim((string) $value), 1000) : '';
    }

    /**
     * Get a short list of non-empty strings from the model's answer.
     *
     * @return array<int, string>
     */
    private function list(mixed $value, int $limit): array
    {
        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(fn (mixed $item): string => $this->text($item))
            ->filter()
            ->take($limit)
            ->values()
            ->all();
    }
}
