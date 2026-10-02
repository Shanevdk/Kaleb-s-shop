<?php

namespace App\Http\Requests;

use App\Actions\DecodeBarcode;
use App\Enums\PartCategory;
use App\Enums\UnitOfMeasure;
use App\Models\InventoryItem;
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
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::enum(PartCategory::class)],
            'unit' => ['required', Rule::enum(UnitOfMeasure::class)],
            'part_number' => ['nullable', 'string', 'max:60'],
            'barcode' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('inventory_items', 'barcode')
                    ->ignore($this->route('inventory_item')),
            ],
            'brand' => ['nullable', 'string', 'max:60'],
            'supplier' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:60'],
            'quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'quantity_shown' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'minimum_quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'unit_cost' => ['required', 'numeric', 'min:0', 'max:999999'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'image', 'max:5120'],
            'remove_image' => ['nullable', 'boolean'],
            'fitments' => ['nullable', 'array', 'max:200'],
            'fitments.*.vehicle_id' => [
                'required',
                'distinct',
                Rule::exists('vehicles', 'id'),
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
     * Get how much the amount on hand was changed by on the edit form.
     *
     * The change is measured from what the form showed when it was opened,
     * not from what is on the shelf now, so stock a job took in the meantime
     * is never put back by saving the form. Without the amount shown, the
     * number typed in is taken as the new count.
     */
    public function quantityChange(InventoryItem $inventoryItem): float
    {
        $shown = $this->validated('quantity_shown') ?? $inventoryItem->quantity;

        return round((float) $this->validated('quantity') - (float) $shown, 2);
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

        $this->describeFromBarcode();
    }

    /**
     * Let a part be added with nothing but its barcode: the barcode decoder
     * names it and fills in the brand. A code nobody knows names the part
     * after itself, so it can still be saved and renamed later.
     */
    private function describeFromBarcode(): void
    {
        $barcode = $this->input('barcode');

        if ($barcode === null || trim((string) $this->input('name')) !== '') {
            return;
        }

        $decoded = app(DecodeBarcode::class)->handle($barcode);

        $this->merge([
            'name' => $decoded['description'] ?? $barcode,
            'brand' => trim((string) $this->input('brand')) ?: $decoded['brand'],
        ]);
    }
}
