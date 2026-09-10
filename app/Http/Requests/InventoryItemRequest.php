<?php

namespace App\Http\Requests;

use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InventoryItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $inventoryItem = $this->route('inventory_item');

        return $inventoryItem === null || $this->user()->can('update', $inventoryItem);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'category' => ['required', Rule::enum(PartCategory::class)],
            'unit' => ['required', Rule::enum(UnitOfMeasure::class)],
            'part_number' => ['nullable', 'string', 'max:60'],
            'barcode' => [
                'nullable',
                'string',
                'max:64',
                Rule::unique('inventory_items', 'barcode')
                    ->where('user_id', $this->user()->id)
                    ->ignore($this->route('inventory_item')),
            ],
            'brand' => ['nullable', 'string', 'max:60'],
            'supplier' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:60'],
            'quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'minimum_quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'unit_cost' => ['required', 'numeric', 'min:0', 'max:999999'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'image', 'max:5120'],
            'remove_image' => ['nullable', 'boolean'],
            'fitments' => ['nullable', 'array', 'max:200'],
            'fitments.*.vehicle_id' => [
                'required',
                'distinct',
                Rule::exists('vehicles', 'id')->where('user_id', $this->user()->id),
            ],
            'fitments.*.quantity_needed' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'fitments.*.notes' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * Get the fitments keyed by vehicle, ready to sync onto the part.
     *
     * @return array<string, array{quantity_needed: float, notes: string|null}>
     */
    public function fitments(): array
    {
        $fitments = [];

        foreach ($this->validated('fitments', []) as $fitment) {
            $fitments[(string) $fitment['vehicle_id']] = [
                'quantity_needed' => (float) ($fitment['quantity_needed'] ?? 1) ?: 1,
                'notes' => $fitment['notes'] ?? null,
            ];
        }

        return $fitments;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'barcode' => trim((string) $this->input('barcode')) ?: null,
            'unit' => $this->input('unit') ?: UnitOfMeasure::Each->value,
            'quantity' => $this->input('quantity') ?: 0,
            'minimum_quantity' => $this->input('minimum_quantity') ?: 0,
            'unit_cost' => $this->input('unit_cost') ?: 0,
        ]);
    }
}
