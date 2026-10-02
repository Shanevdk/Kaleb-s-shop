<?php

namespace Database\Factories;

use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EquipmentChecklist>
 */
class EquipmentChecklistFactory extends Factory
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
            'title' => 'Safety check',
            'performed_on' => fake()->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'notes' => null,
            'completed_at' => null,
        ];
    }

    /**
     * Indicate that the checklist has been signed off.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes): array => [
            'completed_at' => now(),
        ]);
    }
}
