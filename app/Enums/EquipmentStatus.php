<?php

namespace App\Enums;

enum EquipmentStatus: string
{
    case Active = 'active';
    case OutOfService = 'out_of_service';
    case Retired = 'retired';

    /**
     * Get the human readable label for the status.
     */
    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::OutOfService => 'Out of service',
            self::Retired => 'Retired',
        };
    }

    /**
     * Get every status as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $status): array => ['value' => $status->value, 'label' => $status->label()],
            self::cases(),
        );
    }
}
