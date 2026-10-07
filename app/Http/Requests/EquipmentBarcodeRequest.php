<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EquipmentBarcodeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request, which takes
     * the permission for the division the equipment belongs to.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('equipment'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'barcode' => [
                'required',
                'string',
                'max:255',
                Rule::unique('equipment', 'barcode')->ignore($this->route('equipment')),
            ],
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
            'barcode.unique' => __('That code is already on another piece of equipment.'),
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'barcode' => trim((string) $this->input('barcode')),
        ]);
    }
}
