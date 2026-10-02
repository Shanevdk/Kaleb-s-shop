<?php

namespace Database\Factories;

use App\Enums\CheckStatus;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentChecklistItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EquipmentChecklistItem>
 */
class EquipmentChecklistItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'equipment_checklist_id' => EquipmentChecklist::factory(),
            'label' => fake()->randomElement(['Check for leaks', 'Test emergency stop', 'Check guards are fitted', 'Check hoses for wear']),
            'status' => CheckStatus::Pending,
            'notes' => null,
            'position' => 0,
        ];
    }
}
