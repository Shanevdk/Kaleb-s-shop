<?php

namespace App\Models;

use App\Enums\Permission;
use Database\Factories\FeedbackFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * A problem or idea someone on the team sent the admins from the Feedback
 * button, with the page they were on when they sent it.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string $message
 * @property string|null $page
 * @property Carbon|null $resolved_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['message', 'page'])]
class Feedback extends Model
{
    /** @use HasFactory<FeedbackFactory> */
    use HasFactory, HasUlids;

    /**
     * Get everyone who looks after the team, and so hears about feedback.
     *
     * @return Collection<int, User>
     */
    public static function recipients(): Collection
    {
        return User::query()
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user): bool => $user->hasPermission(Permission::ManageTeam))
            ->values()
            ->toBase();
    }

    /**
     * Get the person who sent it.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Only include feedback an admin has not dealt with yet.
     *
     * @param  Builder<Feedback>  $query
     */
    #[Scope]
    protected function open(Builder $query): void
    {
        $query->whereNull('resolved_at');
    }

    /**
     * Only include feedback an admin has dealt with.
     *
     * @param  Builder<Feedback>  $query
     */
    #[Scope]
    protected function resolved(Builder $query): void
    {
        $query->whereNotNull('resolved_at');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }
}
