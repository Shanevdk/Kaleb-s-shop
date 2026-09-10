<?php

namespace Database\Factories;

use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
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
            'inventory_item_id' => InventoryItem::factory(),
            'vehicle_id' => null,
            'service_record_id' => null,
            'quantity' => fake()->randomFloat(2, -5, 5),
            'note' => null,
        ];
    }
}
