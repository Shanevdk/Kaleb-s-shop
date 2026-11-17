<?php

namespace App\Models;

use Database\Factories\ApiKeyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A key an admin made so another app can read the shop's data through the
 * API. Only a hash of the key is kept: the key itself is shown once, when it
 * is made, and deleting the record stops it working straight away.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string $name
 * @property string $token_hash
 * @property string $last_four
 * @property Carbon|null $last_used_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name'])]
#[Hidden(['token_hash'])]
class ApiKey extends Model
{
    /** @use HasFactory<ApiKeyFactory> */
    use HasFactory, HasUlids;

    /**
     * What every key starts with, so one is easy to recognise if it turns
     * up somewhere it should not be.
     */
    public const PREFIX = 'vdk_';

    /**
     * Make a new key for the given app, returning the key itself alongside
     * the saved record. This is the only time the key can be read.
     *
     * @return array{0: ApiKey, 1: string}
     */
    public static function generate(string $name, ?User $madeBy): array
    {
        $token = self::PREFIX.Str::random(48);

        $apiKey = new self(['name' => $name]);
        $apiKey->forceFill([
            'user_id' => $madeBy?->id,
            'token_hash' => self::hash($token),
            'last_four' => substr($token, -4),
        ])->save();

        return [$apiKey, $token];
    }

    /**
     * Find the key an app sent, if it is one that still works.
     */
    public static function findByToken(string $token): ?self
    {
        return self::query()->where('token_hash', self::hash($token))->first();
    }

    /**
     * Get the hash a key is stored and looked up by.
     */
    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Note that the key was just used, at most once a minute so a busy app
     * does not write to the database on every request.
     */
    public function markAsUsed(): void
    {
        if ($this->last_used_at === null || $this->last_used_at->lt(now()->subMinute())) {
            $this->forceFill(['last_used_at' => now()])->saveQuietly();
        }
    }

    /**
     * Get the admin who made the key.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
        ];
    }
}
