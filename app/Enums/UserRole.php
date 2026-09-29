<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Mechanic = 'mechanic';
    case Scheduler = 'scheduler';
    case Shopper = 'shopper';

    /**
     * Get the human readable label for the role.
     */
    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Mechanic => 'Mechanic',
            self::Scheduler => 'Scheduler',
            self::Shopper => 'Shopper',
        };
    }

    /**
     * Describe what someone with the role can do.
     */
    public function description(): string
    {
        return match ($this) {
            self::Admin => 'Everything a mechanic can do, plus adding and removing people on the team.',
            self::Mechanic => 'Vehicles, jobs, checklists, parts, the shopping list, receiving deliveries, lookup and the assistant.',
            self::Scheduler => 'Sees the schedule, adds jobs to it and moves things around. Cannot open vehicles, checklists or parts.',
            self::Shopper => 'Can only see the shopping list and tick off what has been ordered.',
        };
    }

    /**
     * Determine whether the role can add, remove and change people.
     */
    public function canManageTeam(): bool
    {
        return $this === self::Admin;
    }

    /**
     * Determine whether the role can see and change the shop's vehicles,
     * jobs, checklists and parts.
     */
    public function canWorkOnRecords(): bool
    {
        return $this === self::Admin || $this === self::Mechanic;
    }

    /**
     * Determine whether the role can see the schedule, add jobs to it and
     * move things on it.
     */
    public function canManageSchedule(): bool
    {
        return $this !== self::Shopper;
    }

    /**
     * Get every role as a select option.
     *
     * @return array<int, array{value: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $role): array => ['value' => $role->value, 'label' => $role->label(), 'description' => $role->description()],
            self::cases(),
        );
    }
}
