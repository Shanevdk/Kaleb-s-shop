<?php

namespace App\Enums;

enum ServiceType: string
{
    case OilChange = 'oil_change';
    case Brakes = 'brakes';
    case Tyres = 'tyres';
    case Suspension = 'suspension';
    case Engine = 'engine';
    case Transmission = 'transmission';
    case Electrical = 'electrical';
    case Diagnostics = 'diagnostics';
    case BodyWork = 'body_work';
    case Inspection = 'inspection';
    case Other = 'other';

    /**
     * Get the human readable label for the service type.
     */
    public function label(): string
    {
        return match ($this) {
            self::OilChange => 'Oil change',
            self::Brakes => 'Brakes',
            self::Tyres => 'Tyres & wheels',
            self::Suspension => 'Suspension & steering',
            self::Engine => 'Engine',
            self::Transmission => 'Transmission & drivetrain',
            self::Electrical => 'Electrical',
            self::Diagnostics => 'Diagnostics',
            self::BodyWork => 'Body work',
            self::Inspection => 'Inspection / service',
            self::Other => 'Other',
        };
    }

    /**
     * Get every service type as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $type): array => ['value' => $type->value, 'label' => $type->label()],
            self::cases(),
        );
    }
}
