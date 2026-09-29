<?php

namespace Database\Factories;

use App\Enums\ChecklistTemplate;
use App\Models\PlannedInspection;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlannedInspection>
 */
class PlannedInspectionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $dueOn = today()->addDays(fake()->numberBetween(0, 20));

        return [
            'vehicle_id' => Vehicle::factory(),
            'template' => ChecklistTemplate::MonthlyCheck,
            'period' => $dueOn->format('Y-m'),
            'due_on' => $dueOn->toDateString(),
        ];
    }

    /**
     * Book the vehicle's annual inspection instead of a monthly check.
     */
    public function annual(): static
    {
        return $this->state(fn (array $attributes): array => [
            'template' => ChecklistTemplate::AnnualInspection,
            'period' => substr((string) $attributes['due_on'], 0, 4),
        ]);
    }
}
