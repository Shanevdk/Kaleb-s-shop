<?php

namespace Database\Factories;

use App\Enums\CheckStatus;
use App\Models\Inspection;
use App\Models\InspectionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InspectionItem>
 */
class InspectionItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'inspection_id' => Inspection::factory(),
            'section' => 'Engine bay',
            'label' => fake()->randomElement(['Check coolant level', 'Replace oil filter', 'Check drive belts']),
            'status' => CheckStatus::Pending,
            'notes' => null,
            'position' => 0,
        ];
    }
}
