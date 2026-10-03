<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\ServiceRecord;
use App\Models\User;

class ServiceRecordPolicy
{
    /**
     * Determine whether the user can view the service record.
     */
    public function view(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->hasPermission(Permission::ServiceLog);
    }

    /**
     * Determine whether the user can create service records.
     */
    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::ServiceLog);
    }

    /**
     * Determine whether the user can update the service record.
     */
    public function update(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->hasPermission(Permission::ServiceLog);
    }

    /**
     * Determine whether the user can delete the service record.
     */
    public function delete(User $user, ServiceRecord $serviceRecord): bool
    {
        return $user->hasPermission(Permission::ServiceLog);
    }
}
