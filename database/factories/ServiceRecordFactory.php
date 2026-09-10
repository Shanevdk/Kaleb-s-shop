<?php

namespace Database\Factories;

use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServiceRecord>
 */
class ServiceRecordFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $user = User::factory();

        return [
            'user_id' => $user,
            'vehicle_id' => Vehicle::factory()->for($user),
            'title' => fake()->randomElement(['Full service', 'Front brake pads', 'Timing belt', 'Clutch replacement', 'Battery swap']),
            'type' => fake()->randomElement(ServiceType::cases()),
            'status' => ServiceStatus::Completed,
            'performed_on' => fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d'),
            'odometer' => fake()->numberBetween(1000, 350000),
            'hours' => fake()->randomFloat(2, 0.5, 12),
            'parts_cost' => fake()->randomFloat(2, 0, 1500),
            'labour_cost' => fake()->randomFloat(2, 0, 1200),
            'description' => fake()->sentence(),
        ];
    }

    /**
     * Indicate that the work is still in progress.
     */
    public function inProgress(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => ServiceStatus::InProgress,
        ]);
    }

    /**
     * Indicate that the work is planned for the future.
     */
    public function planned(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => ServiceStatus::Planned,
        ]);
    }
}
