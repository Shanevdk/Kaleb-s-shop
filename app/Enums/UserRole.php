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
            self::Mechanic => 'Vehicles, jobs, checklists, the schedule, parts, equipment, lookup, diagnose and the assistant.',
            self::Scheduler => 'Sees the schedule, adds jobs to it and moves things around. Cannot open vehicles, checklists or parts.',
            self::Shopper => 'Can only see the shopping list and tick off what has been ordered.',
        };
    }

    /**
     * Get the permissions this role grants on its own, before any extra
     * permissions are added to the account individually.
     *
     * @return array<int, string>
     */
    public function defaultPermissions(): array
    {
        return array_map(
            fn (Permission $permission): string => $permission->value,
            match ($this) {
                self::Admin => Permission::cases(),
                self::Mechanic => array_values(array_filter(
                    Permission::cases(),
                    fn (Permission $permission): bool => $permission !== Permission::ManageTeam,
                )),
                self::Scheduler => [Permission::Schedule, Permission::ShoppingList],
                self::Shopper => [Permission::ShoppingList],
            },
        );
    }

    /**
     * Get every role as a select option.
     *
     * @return array<int, array{value: string, label: string, description: string, default_permissions: array<int, string>}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $role): array => [
                'value' => $role->value,
                'label' => $role->label(),
                'description' => $role->description(),
                'default_permissions' => $role->defaultPermissions(),
            ],
            self::cases(),
        );
    }
}
