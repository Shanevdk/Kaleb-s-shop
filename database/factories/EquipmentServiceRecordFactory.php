<?php

namespace Database\Factories;

use App\Enums\EquipmentServiceType;
use App\Enums\ServiceStatus;
use App\Models\Equipment;
use App\Models\EquipmentServiceRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EquipmentServiceRecord>
 */
class EquipmentServiceRecordFactory extends Factory
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
            'equipment_id' => Equipment::factory()->for($user),
            'title' => fake()->randomElement(['Annual service', 'Belt replacement', 'Filter change', 'Calibration']),
            'type' => fake()->randomElement(EquipmentServiceType::cases()),
            'status' => ServiceStatus::Completed,
            'performed_on' => fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d'),
            'hours' => fake()->randomFloat(2, 0.5, 8),
            'parts_cost' => fake()->randomFloat(2, 0, 800),
            'labour_cost' => fake()->randomFloat(2, 0, 600),
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
