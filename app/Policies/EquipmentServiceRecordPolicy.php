<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\EquipmentServiceRecord;
use App\Models\User;

class EquipmentServiceRecordPolicy
{
    /**
     * Determine whether the user can view the service record.
     */
    public function view(User $user, EquipmentServiceRecord $equipmentServiceRecord): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can update the service record.
     */
    public function update(User $user, EquipmentServiceRecord $equipmentServiceRecord): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can delete the service record.
     */
    public function delete(User $user, EquipmentServiceRecord $equipmentServiceRecord): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }
}
