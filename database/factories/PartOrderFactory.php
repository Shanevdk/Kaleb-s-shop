<?php

namespace Database\Factories;

use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
use App\Models\PartOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartOrder>
 */
class PartOrderFactory extends Factory
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
            'inventory_item_id' => null,
            'name' => fake()->randomElement(['Rear wheel bearing', 'Brake pad set', 'Fuel pump', 'Alternator belt']),
            'part_number' => strtoupper(fake()->bothify('??-####')),
            'brand' => fake()->randomElement(['Bosch', 'Ryco', 'NGK', 'Castrol', 'Brembo']),
            'supplier' => fake()->company(),
            'unit' => UnitOfMeasure::Each,
            'quantity_ordered' => fake()->numberBetween(1, 10),
            'quantity_received' => 0,
            'received_by' => null,
            'received_at' => null,
        ];
    }

    /**
     * Indicate that the order is for a part the shop already stocks.
     */
    public function forItem(InventoryItem $item): static
    {
        return $this->state(fn (array $attributes): array => [
            'inventory_item_id' => $item->id,
            'name' => $item->name,
            'part_number' => $item->part_number,
            'brand' => $item->brand,
            'supplier' => $item->supplier,
            'unit' => $item->unit,
        ]);
    }

    /**
     * Indicate that the whole order has been booked in.
     */
    public function received(): static
    {
        return $this->state(fn (array $attributes): array => [
            'quantity_received' => $attributes['quantity_ordered'],
            'received_at' => now(),
        ]);
    }
}
