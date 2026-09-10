<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
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
            'make' => fake()->randomElement(['Toyota', 'Ford', 'Volkswagen', 'BMW', 'Nissan', 'Mazda']),
            'model' => fake()->randomElement(['Hilux', 'Ranger', 'Golf', '3 Series', 'Navara', 'CX-5']),
            'year' => fake()->numberBetween(1995, 2026),
            'nickname' => null,
            'registration' => strtoupper(fake()->bothify('??###')),
            'vin' => strtoupper(fake()->bothify('#################')),
            'colour' => fake()->safeColorName(),
            'odometer' => fake()->numberBetween(1000, 350000),
            'notes' => null,
        ];
    }
}
