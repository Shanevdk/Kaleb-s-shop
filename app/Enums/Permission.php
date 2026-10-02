<?php

namespace App\Enums;

enum Permission: string
{
    case ManageTeam = 'manage-team';
    case MechanicsShop = 'mechanics-shop';
    case Vehicles = 'vehicles';
    case Lookup = 'lookup';
    case Diagnose = 'diagnose';
    case JobQueue = 'job-queue';
    case ServiceLog = 'service-log';
    case Inspections = 'inspections';
    case Schedule = 'schedule';
    case Inventory = 'inventory';
    case ShoppingList = 'shopping-list';
    case Receiving = 'receiving';
    case Equipment = 'equipment';
    case Assistant = 'assistant';

    /**
     * Get the human readable label for the permission, matching the page it
     * unlocks in the sidebar.
     */
    public function label(): string
    {
        return match ($this) {
            self::ManageTeam => 'Team',
            self::MechanicsShop => "Kaleb's Shop",
            self::Vehicles => 'Vehicles',
            self::Lookup => 'Lookup',
            self::Diagnose => 'Diagnose',
            self::JobQueue => 'Job queue',
            self::ServiceLog => 'Service log',
            self::Inspections => 'Checklists',
            self::Schedule => 'Schedule',
            self::Inventory => 'Inventory',
            self::ShoppingList => 'Shopping list',
            self::Receiving => 'Receive parts',
            self::Equipment => 'Equipment',
            self::Assistant => 'Assistant',
        };
    }

    /**
     * Get the sidebar section the permission's page lives under, so the
     * permissions can be grouped the same way in the team page.
     */
    public function group(): string
    {
        return match ($this) {
            self::ManageTeam => 'Team',
            self::MechanicsShop, self::Equipment => 'Workspace',
            self::Vehicles, self::Lookup => 'Fleet',
            self::Diagnose, self::JobQueue, self::ServiceLog => 'Service',
            self::Inspections, self::Schedule => 'Inspections',
            self::Inventory, self::ShoppingList, self::Receiving => 'Parts',
            self::Assistant => 'Assistant',
        };
    }

    /**
     * Get every permission as a select option.
     *
     * @return array<int, array{value: string, label: string, group: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $permission): array => [
                'value' => $permission->value,
                'label' => $permission->label(),
                'group' => $permission->group(),
            ],
            self::cases(),
        );
    }
}
