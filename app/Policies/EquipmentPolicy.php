<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Equipment;
use App\Models\User;

class EquipmentPolicy
{
    /**
     * Determine whether the user can view the equipment record.
     */
    public function view(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can update the equipment record.
     */
    public function update(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can delete the equipment record.
     */
    public function delete(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }
}
