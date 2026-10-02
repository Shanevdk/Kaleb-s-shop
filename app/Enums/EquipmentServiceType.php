<?php

namespace App\Enums;

enum EquipmentServiceType: string
{
    case Maintenance = 'maintenance';
    case Repair = 'repair';
    case Inspection = 'inspection';
    case Calibration = 'calibration';
    case Other = 'other';

    /**
     * Get the human readable label for the service type.
     */
    public function label(): string
    {
        return match ($this) {
            self::Maintenance => 'Maintenance',
            self::Repair => 'Repair',
            self::Inspection => 'Inspection / service',
            self::Calibration => 'Calibration',
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
