<?php

namespace App\Enums;

/**
 * The equipment divisions: VDK-Equipment, the one the equipment log was
 * first built for, and VDK Equipment USA. Each keeps its own equipment,
 * service log and maintenance schedule, apart from the other's.
 */
enum EquipmentDivision: string
{
    case Main = 'main';
    case Usa = 'usa';

    /**
     * Get the permission that unlocks the division.
     */
    public function permission(): Permission
    {
        return match ($this) {
            self::Main => Permission::Equipment,
            self::Usa => Permission::EquipmentUsa,
        };
    }

    /**
     * Get the name of the division's own copy of a list route, such as
     * equipment.index. VDK Equipment USA's lists sit under usa/.
     */
    public function routeName(string $name): string
    {
        return match ($this) {
            self::Main => $name,
            self::Usa => "usa.{$name}",
        };
    }
}
