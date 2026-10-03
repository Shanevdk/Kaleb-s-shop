<?php

namespace App\Policies;

use App\Models\EquipmentChecklist;
use App\Models\User;

class EquipmentChecklistPolicy
{
    /**
     * Determine whether the user can view the checklist, which takes the
     * permission for the division its equipment belongs to.
     */
    public function view(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission($equipmentChecklist->equipment->division->permission());
    }

    /**
     * Determine whether the user can update the checklist.
     */
    public function update(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission($equipmentChecklist->equipment->division->permission());
    }

    /**
     * Determine whether the user can delete the checklist.
     */
    public function delete(User $user, EquipmentChecklist $equipmentChecklist): bool
    {
        return $user->hasPermission($equipmentChecklist->equipment->division->permission());
    }
}
