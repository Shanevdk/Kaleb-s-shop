<?php

namespace App\Actions;

use App\Enums\MachineKind;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class DecodeVin
{
    /**
     * The public NHTSA vPIC decoder. No key needed.
     */
    private const ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';

    /**
     * Tidy an identifier the way a person would type it: uppercase, no spaces
     * or dashes. VINs never carry I, O or Q but serial numbers can, so those
     * are left alone.
     */
    public static function normalise(?string $identifier): string
    {
        return strtoupper((string) preg_replace('/[\s\-]+/', '', (string) $identifier));
    }

    /**
     * Whether the identifier is shaped like a road vehicle VIN rather than
     * an engine or chassis serial number.
     */
    public static function looksLikeVin(?string $identifier): bool
    {
        return (bool) preg_match('/^[A-HJ-NPR-Z0-9]{17}$/', self::normalise($identifier));
    }

    /**
     * Decode a VIN into the machine's specs, or null when nothing useful comes back.
     *
     * Serial numbers that are not VINs are never sent off; the shop fills those
     * in by hand. Results are cached for a month because a VIN never changes
     * meaning, and a decoder outage returns null rather than an error so the
     * vehicle can still be saved.
     *
     * @return array<string, mixed>|null
     */
    public function handle(?string $identifier): ?array
    {
        $vin = self::normalise($identifier);

        if (! self::looksLikeVin($vin)) {
            return null;
        }

        return Cache::remember("vin-decode:{$vin}", now()->addMonth(), function () use ($vin): ?array {
            try {
                $response = Http::acceptJson()
                    ->timeout(10)
                    ->retry(2, 250, throw: false)
                    ->get(self::ENDPOINT.$vin, ['format' => 'json'])
                    ->throw();
            } catch (ConnectionException|RequestException) {
                return null;
            }

            /** @var array<string, mixed> $result */
            $result = $response->json('Results.0', []);

            return $this->transform($vin, $result);
        });
    }

    /**
     * Turn the decoder's flat, blank-heavy row into something worth keeping.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>|null
     */
    private function transform(string $vin, array $row): ?array
    {
        $text = fn (string $key): ?string => filled($row[$key] ?? null) ? trim((string) $row[$key]) : null;
        $int = fn (string $key): ?int => is_numeric($row[$key] ?? null) ? (int) $row[$key] : null;
        $float = fn (string $key): ?float => is_numeric($row[$key] ?? null) ? round((float) $row[$key], 2) : null;

        if ($text('Make') === null && $text('ModelYear') === null) {
            return null;
        }

        $bodyClass = $text('BodyClass');
        $vehicleType = $text('VehicleType');
        $errorCode = $text('ErrorCode');

        $displacement = $float('DisplacementL') ?? ($float('DisplacementCC') !== null ? round($float('DisplacementCC') / 1000, 2) : null);

        return [
            'source' => 'nhtsa',
            'vin' => $vin,
            'decoded_at' => now()->toIso8601String(),
            'kind' => MachineKind::fromBodyClass($bodyClass, $vehicleType)->value,
            'make' => $text('Make') !== null ? ucwords(strtolower($text('Make'))) : null,
            'model' => $text('Model'),
            'year' => $int('ModelYear'),
            'trim' => $text('Trim'),
            'series' => $text('Series'),
            'body_class' => $bodyClass,
            'vehicle_type' => $vehicleType !== null ? ucwords(strtolower($vehicleType)) : null,
            'doors' => $int('Doors'),
            'drive_type' => $text('DriveType'),
            'transmission' => trim(implode(' ', array_filter([
                $text('TransmissionSpeeds') !== null ? $text('TransmissionSpeeds').'-speed' : null,
                $text('TransmissionStyle'),
            ]))) ?: null,
            'gvwr' => $text('GVWR'),
            'manufacturer' => $text('Manufacturer'),
            'plant' => trim(implode(', ', array_filter([$text('PlantCity') !== null ? ucwords(strtolower($text('PlantCity'))) : null, $text('PlantCountry')]))) ?: null,
            'engine' => [
                'cylinders' => $int('EngineCylinders'),
                'displacement_l' => $displacement,
                'configuration' => $text('EngineConfiguration'),
                'fuel' => $text('FuelTypePrimary'),
                'horsepower' => $int('EngineHP'),
                'kilowatts' => $float('EngineKW') !== null ? (int) round($float('EngineKW')) : null,
                'model' => $text('EngineModel'),
                'manufacturer' => $text('EngineManufacturer'),
                'turbo' => $text('Turbo') !== null ? str_contains(strtolower($text('Turbo')), 'yes') : null,
                'valve_train' => $text('ValveTrainDesign'),
            ],
            'warnings' => $errorCode !== null && $errorCode !== '0' ? $text('ErrorText') : null,
        ];
    }
}
