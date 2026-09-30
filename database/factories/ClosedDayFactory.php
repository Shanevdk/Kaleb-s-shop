<?php

namespace Database\Factories;

use App\Models\ClosedDay;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClosedDay>
 */
class ClosedDayFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'date' => fake()->unique()->dateTimeBetween('now', '+3 months')->format('Y-m-d'),
            'reason' => fake()->randomElement(['Stocktake', 'Staff training', 'Shop closed']),
        ];
    }
}
