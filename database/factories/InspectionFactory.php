<?php

namespace Database\Factories;

use App\Enums\ChecklistTemplate;
use App\Models\Inspection;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Inspection>
 */
class InspectionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $user = User::factory();
        $template = fake()->randomElement(ChecklistTemplate::cases());

        return [
            'user_id' => $user,
            'vehicle_id' => Vehicle::factory()->for($user),
            'template' => $template,
            'title' => $template->label(),
            'performed_on' => fake()->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'odometer' => fake()->numberBetween(1000, 350000),
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

    /**
     * Populate the checklist items from its template once created.
     */
    public function withItems(): static
    {
        return $this->afterCreating(fn (Inspection $inspection) => $inspection->fillFromTemplate());
    }
}
