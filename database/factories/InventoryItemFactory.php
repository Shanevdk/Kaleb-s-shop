<?php

namespace Database\Factories;

use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryItem>
 */
class InventoryItemFactory extends Factory
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
            'name' => fake()->randomElement(['Oil filter', 'Brake pad set', 'Spark plug', 'Wiper blade', 'Air filter', 'Engine oil 5W-30']),
            'category' => fake()->randomElement(PartCategory::cases()),
            'unit' => UnitOfMeasure::Each,
            'part_number' => strtoupper(fake()->bothify('??-####')),
            'brand' => fake()->randomElement(['Bosch', 'Ryco', 'NGK', 'Castrol', 'Brembo']),
            'supplier' => fake()->company(),
            'location' => fake()->randomElement(['Shelf A1', 'Shelf B3', 'Bin 12', 'Back room']),
            'quantity' => fake()->numberBetween(0, 40),
            'minimum_quantity' => fake()->numberBetween(0, 5),
            'unit_cost' => fake()->randomFloat(2, 2, 400),
            'image_path' => null,
            'notes' => null,
        ];
    }

    /**
     * Indicate that the part needs reordering.
     */
    public function lowStock(): static
    {
        return $this->state(fn (array $attributes): array => [
            'quantity' => 1,
            'minimum_quantity' => 5,
        ]);
    }

    /**
     * Indicate that the part is poured rather than counted.
     */
    public function fluid(): static
    {
        return $this->state(fn (array $attributes): array => [
            'name' => 'Engine oil 5W-30',
            'category' => PartCategory::Fluids,
            'unit' => UnitOfMeasure::Litre,
            'quantity' => 20,
            'minimum_quantity' => 5,
        ]);
    }
}
