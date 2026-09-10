<?php

namespace App\Policies;

use App\Models\ServiceRecord;
use App\Models\User;

class ServiceRecordPolicy
{
    /**
     * Determine whether the user can view the service record.
     */
    public function view(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->id === $serviceRecord->user_id;
    }

    /**
     * Determine whether the user can update the service record.
     */
    public function update(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->id === $serviceRecord->user_id;
    }

    /**
     * Determine whether the user can delete the service record.
     */
    public function delete(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->id === $serviceRecord->user_id;
    }
}
