<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property UserRole $role
 * @property AccountStatus $status
 * @property array<int, string>|null $permissions
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUlids, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * Get the vehicles that belong to the user.
     *
     * @return HasMany<Vehicle, $this>
     */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    /**
     * Get the service records logged by the user.
     *
     * @return HasMany<ServiceRecord, $this>
     */
    public function serviceRecords(): HasMany
    {
        return $this->hasMany(ServiceRecord::class);
    }

    /**
     * Get the checklists the user has run.
     *
     * @return HasMany<Inspection, $this>
     */
    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    /**
     * Get the parts the user keeps in stock.
     *
     * @return HasMany<InventoryItem, $this>
     */
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    /**
     * Get the equipment records the user added.
     *
     * @return HasMany<Equipment, $this>
     */
    public function equipment(): HasMany
    {
        return $this->hasMany(Equipment::class);
    }

    /**
     * Get the equipment checklists the user ran.
     *
     * @return HasMany<EquipmentChecklist, $this>
     */
    public function equipmentChecklists(): HasMany
    {
        return $this->hasMany(EquipmentChecklist::class);
    }

    /**
     * Get the equipment service records the user logged.
     *
     * @return HasMany<EquipmentServiceRecord, $this>
     */
    public function equipmentServiceRecords(): HasMany
    {
        return $this->hasMany(EquipmentServiceRecord::class);
    }

    /**
     * Get the stock the user has taken off the shelf or put back on it.
     *
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * Get the parts the user has ticked off the shopping list as ordered.
     *
     * @return HasMany<PartOrder, $this>
     */
    public function partOrders(): HasMany
    {
        return $this->hasMany(PartOrder::class);
    }

    /**
     * Determine whether an administrator has let the user in. Someone who
     * signed themselves up gets nothing until they have.
     */
    public function isApproved(): bool
    {
        return $this->status === AccountStatus::Approved;
    }

    /**
     * Send the email verification link, except to someone still waiting to
     * be accepted: accepting them vouches for their address instead.
     */
    public function sendEmailVerificationNotification(): void
    {
        if ($this->isApproved()) {
            parent::sendEmailVerificationNotification();
        }
    }

    /**
     * Determine whether the user holds the given permission, either because
     * their role grants it by default or because it was added to their
     * account individually. An account nobody has approved holds none.
     */
    public function hasPermission(Permission $permission): bool
    {
        if (! $this->isApproved()) {
            return false;
        }

        return in_array($permission->value, $this->role->defaultPermissions(), true)
            || in_array($permission->value, $this->permissions ?? [], true);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => AccountStatus::class,
            'permissions' => 'array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * Get the default attribute values.
     *
     * Mirrors the column defaults, so a freshly created user is an approved
     * mechanic without being reloaded.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'role' => 'mechanic',
        'status' => 'approved',
    ];
}
