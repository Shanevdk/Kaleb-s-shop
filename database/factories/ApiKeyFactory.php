<?php

namespace Database\Factories;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ApiKey>
 */
class ApiKeyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $token = ApiKey::PREFIX.Str::random(48);

        return [
            'user_id' => User::factory(),
            'name' => fake()->randomElement(['Accounting', 'Reports', 'Fleet tracker']),
            'token_hash' => ApiKey::hash($token),
            'last_four' => substr($token, -4),
            'last_used_at' => null,
        ];
    }

    /**
     * Use the given key, so a test can send it.
     */
    public function withToken(string $token): static
    {
        return $this->state(fn (array $attributes): array => [
            'token_hash' => ApiKey::hash($token),
            'last_four' => substr($token, -4),
        ]);
    }
}
