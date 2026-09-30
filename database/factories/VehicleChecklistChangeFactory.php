<?php

namespace Database\Factories;

use App\Enums\ChecklistChange;
use App\Enums\ChecklistTemplate;
use App\Models\Vehicle;
use App\Models\VehicleChecklistChange;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehicleChecklistChange>
 */
class VehicleChecklistChangeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehicle_id' => Vehicle::factory(),
            'template' => ChecklistTemplate::MonthlyCheck,
            'section' => 'Extra checks',
            'label' => fake()->randomElement(['Tow hitch pin and clip', 'Canopy seals', 'Winch cable']),
            'action' => ChecklistChange::Add,
        ];
    }

    /**
     * Indicate that a standard check is left out rather than added.
     */
    public function removal(string $label): static
    {
        return $this->state(fn (array $attributes): array => [
            'section' => null,
            'label' => $label,
            'action' => ChecklistChange::Remove,
        ]);
    }
}
