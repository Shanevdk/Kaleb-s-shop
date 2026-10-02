<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\EquipmentChecklist;
use App\Models\User;

class EquipmentChecklistPolicy
{
    /**
     * Determine whether the user can view the checklist.
     */
    public function view(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can update the checklist.
     */
    public function update(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }

    /**
     * Determine whether the user can delete the checklist.
     */
    public function delete(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission(Permission::Equipment);
    }
}
