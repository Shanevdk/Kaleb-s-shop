<?php

namespace App\Actions;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FetchRecalls
{
    /**
     * The public NHTSA recalls feed. No key needed.
     */
    private const ENDPOINT = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

    /**
     * Get the safety recalls issued for a make, model and year, newest first.
     *
     * Recalls are only ever added, so a day in the cache is plenty. An outage
     * or an unknown model returns an empty list rather than an error so the
     * vehicle page still loads.
     *
     * @return array<int, array{campaign: string, date: string|null, component: string|null, summary: string|null, consequence: string|null, remedy: string|null}>
     */
    public function handle(string $make, string $model, int $year): array
    {
        $key = 'recalls:'.md5(strtolower("{$make}|{$model}|{$year}"));

        return Cache::remember($key, now()->addDay(), function () use ($make, $model, $year): array {
            try {
                $response = Http::acceptJson()
                    ->timeout(10)
                    ->get(self::ENDPOINT, [
                        'make' => $make,
                        'model' => $model,
                        'modelYear' => $year,
                    ])
                    ->throw();
            } catch (ConnectionException|RequestException) {
                return [];
            }

            /** @var array<int, array<string, mixed>> $results */
            $results = $response->json('results', []);

            $recalls = array_map(fn (array $recall): array => [
                'campaign' => (string) ($recall['NHTSACampaignNumber'] ?? ''),
                'date' => $this->date($recall['ReportReceivedDate'] ?? null),
                'component' => $this->text($recall['Component'] ?? null),
                'summary' => $this->text($recall['Summary'] ?? null),
                'consequence' => $this->text($recall['Consequence'] ?? null),
                'remedy' => $this->text($recall['Remedy'] ?? null),
            ], $results);

            usort($recalls, fn (array $a, array $b): int => strcmp((string) $b['date'], (string) $a['date']));

            return $recalls;
        });
    }

    private function text(mixed $value): ?string
    {
        return filled($value) ? trim((string) $value) : null;
    }

    /**
     * The feed writes dates as 24/07/2023; keep them as ISO for the front end.
     */
    private function date(mixed $value): ?string
    {
        if (! filled($value) || ! preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', (string) $value, $parts)) {
            return null;
        }

        return "{$parts[3]}-{$parts[2]}-{$parts[1]}";
    }
}
