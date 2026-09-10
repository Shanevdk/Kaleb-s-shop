<?php

namespace App\Policies;

use App\Models\Inspection;
use App\Models\User;

class InspectionPolicy
{
    /**
     * Determine whether the user can view the checklist.
     */
    public function view(User $user, Inspection $inspection): bool
    {
        return $user->id === $inspection->user_id;
    }

    /**
     * Determine whether the user can update the checklist.
     */
    public function update(User $user, Inspection $inspection): bool
    {
        return $user->id === $inspection->user_id;
    }

    /**
     * Determine whether the user can delete the checklist.
     */
    public function delete(User $user, Inspection $inspection): bool
    {
        return $user->id === $inspection->user_id;
    }
}
