<?php

namespace App\Policies;

use App\Models\InventoryItem;
use App\Models\User;

class InventoryItemPolicy
{
    /**
     * Determine whether the user can view the stocked part.
     */
    public function view(User $user, InventoryItem $inventoryItem): bool
    {
        return $user->id === $inventoryItem->user_id;
    }

    /**
     * Determine whether the user can update the stocked part.
     */
    public function update(User $user, InventoryItem $inventoryItem): bool
    {
        return $user->id === $inventoryItem->user_id;
    }

    /**
     * Determine whether the user can delete the stocked part.
     */
    public function delete(User $user, InventoryItem $inventoryItem): bool
    {
        return $user->id === $inventoryItem->user_id;
    }
}
