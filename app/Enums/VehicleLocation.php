<?php

namespace App\Enums;

/**
 * Where a vehicle is kept: the Norwich shop, the Kentwood one, or both.
 */
enum VehicleLocation: string
{
    case Norwich = 'norwich';
    case Kentwood = 'kentwood';
    case Both = 'both';

    /**
     * Get the human readable label for the location.
     */
    public function label(): string
    {
        return match ($this) {
            self::Norwich => 'Norwich',
            self::Kentwood => 'Kentwood',
            self::Both => 'Norwich & Kentwood',
        };
    }

    /**
     * Whether the vehicle's monthly checks and annual inspections are booked
     * onto the schedule automatically. Only vehicles kept at Norwich alone
     * are; the rest are looked after outside the schedule.
     */
    public function isBookedAutomatically(): bool
    {
        return $this === self::Norwich;
    }

    /**
     * Get every location as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $location): array => ['value' => $location->value, 'label' => $location->label()],
            self::cases(),
        );
    }
}
