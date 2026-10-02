<?php

namespace Database\Factories;

use App\Enums\EquipmentStatus;
use App\Models\Equipment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Equipment>
 */
class EquipmentFactory extends Factory
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
            'name' => fake()->randomElement(['Air compressor', 'Hydraulic lift', 'Tyre balancer', 'Welder', 'Generator', 'Pressure washer']),
            'category' => fake()->randomElement(['Shop tool', 'Lift', 'Power tool']),
            'serial_number' => strtoupper(fake()->bothify('??-####')),
            'location' => fake()->randomElement(['Bay 1', 'Bay 2', 'Store room']),
            'status' => EquipmentStatus::Active,
            'purchased_on' => fake()->dateTimeBetween('-5 years', '-1 month')->format('Y-m-d'),
            'notes' => null,
        ];
    }
}
