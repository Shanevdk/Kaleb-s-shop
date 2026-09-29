<?php

namespace App\Http\Requests;

use App\Enums\UnitOfMeasure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PartOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Everyone who can see the shopping list can tick parts off it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'inventory_item_id' => ['nullable', 'string', Rule::exists('inventory_items', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'part_number' => ['nullable', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'unit' => ['required', Rule::enum(UnitOfMeasure::class)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:99999'],
        ];
    }

    /**
     * Get the custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'quantity.gt' => __('Order at least one.'),
        ];
    }
}
