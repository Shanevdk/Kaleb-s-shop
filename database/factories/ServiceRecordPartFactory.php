<?php

namespace Database\Factories;

use App\Enums\UnitOfMeasure;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServiceRecordPart>
 */
class ServiceRecordPartFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'service_record_id' => ServiceRecord::factory(),
            'inventory_item_id' => null,
            'name' => fake()->randomElement(['Rear wheel bearing', 'Brake pad set', 'Timing belt kit', 'Sump plug washer']),
            'quantity' => fake()->numberBetween(1, 4),
            'unit' => UnitOfMeasure::Each,
            'quantity_taken' => 0,
        ];
    }
}
