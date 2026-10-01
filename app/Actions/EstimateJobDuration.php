<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\OpenRouter;
use App\Models\ServiceRecord;
use App\Models\Vehicle;
use Illuminate\Support\Str;

class EstimateJobDuration
{
    /**
     * Seconds the AI gets, fallbacks included, so the answer comes back
     * inside the minute a web request is allowed.
     */
    private const BUDGET = 40;

    public function __construct(private OpenRouter $openRouter) {}

    /**
     * Have the AI read the job and the vehicle it is on and estimate how
     * many hours the work will take, written up as a line to go at the top
     * of the job's notes. Nothing is saved here: the caller decides whether
     * to keep it, and the mechanic can edit or overwrite it like any other
     * text before it is saved.
     *
     * @return array{description: string, hours: float, low: float|null, high: float|null, reasoning: string, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    public function handle(ServiceRecord $serviceRecord, ?string $notes): array
    {
        $estimate = $this->ask($serviceRecord, self::withoutEstimate($notes));

        return [
            ...$estimate,
            'description' => $this->withEstimate($notes, $estimate),
        ];
    }

    /**
     * Estimate a saved job from its own notes, for storing on the job.
     *
     * @return array{hours: float, low: float|null, high: float|null, reasoning: string, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    public function estimate(ServiceRecord $serviceRecord): array
    {
        return $this->ask($serviceRecord, self::withoutEstimate($serviceRecord->description));
    }

    /**
     * Get the notes without an "Estimated time:" line left at the top by an
     * earlier estimate, so it is never read back as part of the job.
     */
    public static function withoutEstimate(?string $notes): string
    {
        $trimmedNotes = trim((string) $notes);
        $paragraphs = $trimmedNotes === '' ? [] : (preg_split('/\n{2,}/', $trimmedNotes) ?: []);

        if (($paragraphs[0] ?? '') !== '' && str_starts_with($paragraphs[0], 'Estimated time:')) {
            array_shift($paragraphs);
        }

        return trim(implode("\n\n", $paragraphs));
    }

    /**
     * Have the model estimate the job.
     *
     * @return array{hours: float, low: float|null, high: float|null, reasoning: string, model: string|null}
     *
     * @throws AssistantUnavailable
     */
    private function ask(ServiceRecord $serviceRecord, string $notes): array
    {
        $this->openRouter->ensureConfigured();

        ['message' => $message, 'model' => $model] = $this->openRouter->complete([
            ['role' => 'system', 'content' => $this->instructions()],
            ['role' => 'user', 'content' => $this->brief($serviceRecord, $serviceRecord->vehicle, $notes)],
        ], timeout: 40, reasoning: 'low', budget: self::BUDGET);

        $estimate = $this->parse(trim((string) ($message['content'] ?? '')));

        if ($estimate === null) {
            throw new AssistantUnavailable(__('The AI could not work out an estimate. Try again in a moment.'));
        }

        return [...$estimate, 'model' => $model];
    }

    /**
     * Tell the model how to estimate and how to answer.
     */
    private function instructions(): string
    {
        return <<<'PROMPT'
        You help a mechanic in a small workshop estimate how long a job will take, so it can be scheduled and quoted. Base it on the job itself, any notes already on it, and the vehicle's details and recent history. Give a realistic time for one qualified mechanic working alone on this job in this workshop: the whole job start to finish, not just the headline repair time from a flat-rate guide, so include things like getting the vehicle up, removing what is in the way and testing the fix after.

        Answer with ONLY a JSON object, no prose before or after and no markdown fences, in exactly this shape:
        {
          "hours": a number of hours, to the nearest quarter hour,
          "range": {"low": number, "high": number},
          "reasoning": "One or two sentences on what the time accounts for, and anything that could make it run long."
        }
        PROMPT;
    }

    /**
     * Describe the job and the vehicle for the model.
     */
    private function brief(ServiceRecord $serviceRecord, ?Vehicle $vehicle, ?string $notes): string
    {
        $history = $vehicle === null ? [] : $vehicle->serviceRecords()
            ->where('id', '!=', $serviceRecord->id)
            ->latest('performed_on')
            ->limit(5)
            ->get()
            ->map(fn (ServiceRecord $record): string => trim(sprintf(
                '%s: %s (%s), %s hrs',
                $record->performed_on->format('Y-m-d'),
                $record->title,
                $record->type->label(),
                $record->hours,
            )))
            ->all();

        return implode("\n", array_filter([
            "Job: {$serviceRecord->title} ({$serviceRecord->type->label()})",
            filled($notes) ? "Notes on the job: {$notes}" : 'No notes on the job yet.',
            $vehicle === null ? null : 'Vehicle: '.$vehicle->display_name.', a '.Str::lower($vehicle->machineKind()->label()).'.',
            filled($vehicle?->engine_summary) ? "Engine: {$vehicle->engine_summary}" : null,
            $vehicle?->odometer !== null ? "Odometer or hours: {$vehicle->odometer}" : null,
            filled($vehicle?->notes) ? "Notes on the vehicle: {$vehicle->notes}" : null,
            $history !== [] ? "Recent work on it:\n- ".implode("\n- ", $history) : null,
        ]));
    }

    /**
     * Read the model's JSON answer, forgiving the fences and chatter free
     * models like to wrap it in. Null when there is no usable estimate.
     *
     * @return array{hours: float, low: float|null, high: float|null, reasoning: string}|null
     */
    private function parse(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $data = json_decode(substr($content, $start, $end - $start + 1), true);

        if (! is_array($data) || ! is_numeric($data['hours'] ?? null)) {
            return null;
        }

        $hours = $this->quarterHour((float) $data['hours']);
        $range = is_array($data['range'] ?? null) ? $data['range'] : null;
        $low = is_numeric($range['low'] ?? null) ? $this->quarterHour((float) $range['low']) : null;
        $high = is_numeric($range['high'] ?? null) ? $this->quarterHour((float) $range['high']) : null;

        return [
            'hours' => $hours,
            'low' => $low !== null && $low <= $hours ? $low : null,
            'high' => $high !== null && $high >= $hours ? $high : null,
            'reasoning' => Str::limit(trim((string) ($data['reasoning'] ?? '')), 400),
        ];
    }

    /**
     * Keep an hours figure sane and rounded to the nearest quarter hour.
     */
    private function quarterHour(float $hours): float
    {
        return round(max(0.25, min(200, $hours)) * 4) / 4;
    }

    /**
     * Put the estimate at the top of the notes, replacing one already there
     * from an earlier go so trying again does not pile them up.
     *
     * @param  array{hours: float, low: float|null, high: float|null, reasoning: string}  $estimate
     */
    private function withEstimate(?string $notes, array $estimate): string
    {
        $line = $estimate['low'] !== null && $estimate['high'] !== null && $estimate['low'] !== $estimate['high']
            ? "Estimated time: {$estimate['hours']} hours ({$estimate['low']}\u{2013}{$estimate['high']} hrs range)"
            : "Estimated time: {$estimate['hours']} hours";

        if ($estimate['reasoning'] !== '') {
            $line .= " \u{2014} {$estimate['reasoning']}";
        }

        return trim(implode("\n\n", array_filter([$line, self::withoutEstimate($notes)])));
    }
}
