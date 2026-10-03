<?php

namespace App\Policies;

use App\Enums\EquipmentDivision;
use App\Models\Equipment;
use App\Models\User;

class EquipmentPolicy
{
    /**
     * Determine whether the user can open the equipment of any division.
     */
    public function viewAny(User $user): bool
    {
        return collect(EquipmentDivision::cases())
            ->contains(fn (EquipmentDivision $division): bool => $user->hasPermission($division->permission()));
    }

    /**
     * Determine whether the user can view the equipment record, which takes
     * the permission for the division it belongs to.
     */
    public function view(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission($equipment->division->permission());
    }

    /**
     * Determine whether the user can update the equipment record.
     */
    public function update(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission($equipment->division->permission());
    }

    /**
     * Determine whether the user can delete the equipment record.
     */
    public function delete(User $user, Equipment $equipment): bool
    {
        return $user->hasPermission($equipment->division->permission());
    }
}
