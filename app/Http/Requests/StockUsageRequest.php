<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StockUsageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('inventory_item'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'delta' => ['required', 'numeric', 'not_in:0', 'min:-100000', 'max:100000'],
            'vehicle_id' => [
                'nullable',
                'string',
                Rule::exists('vehicles', 'id'),
            ],
            'service_record_id' => [
                'nullable',
                'string',
                Rule::exists('service_records', 'id'),
            ],
            'note' => ['nullable', 'string', 'max:120'],
        ];
    }
}
