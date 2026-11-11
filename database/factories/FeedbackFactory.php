<?php

namespace Database\Factories;

use App\Models\Feedback;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Feedback>
 */
class FeedbackFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'message' => fake()->randomElement([
                'The scanner will not open on my phone.',
                'Saving a checklist shows an error.',
                'Could the job queue show the parts each job is waiting on?',
            ]),
            'page' => fake()->randomElement(['/dashboard', '/job-queue', '/inventory/scan']),
            'resolved_at' => null,
        ];
    }

    /**
     * Indicate that an admin has dealt with the feedback.
     */
    public function resolved(): static
    {
        return $this->state(fn (array $attributes): array => [
            'resolved_at' => now(),
        ]);
    }
}
