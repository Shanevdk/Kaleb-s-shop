<?php

namespace App\Http\Requests;

use App\Actions\DecodeVin;
use App\Enums\MachineKind;
use App\Enums\VehicleCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VehicleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $vehicle = $this->route('vehicle');

        return $vehicle === null || $this->user()->can('update', $vehicle);
    }

    /**
     * Tidy the VIN the same way it is saved, so the same VIN typed with
     * spaces, dashes or lower case is still caught as a duplicate.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('vin')) {
            $this->merge(['vin' => DecodeVin::normalise($this->input('vin')) ?: null]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'make' => ['required', 'string', 'max:60'],
            'model' => ['required', 'string', 'max:60'],
            'year' => ['required', 'integer', 'min:1900', 'max:'.(now()->year + 1)],
            'nickname' => ['nullable', 'string', 'max:60'],
            'registration' => ['nullable', 'string', 'max:20'],
            'vin' => ['nullable', 'string', 'max:32', Rule::unique('vehicles', 'vin')->ignore($this->route('vehicle'))],
            'colour' => ['nullable', 'string', 'max:40'],
            'odometer' => ['nullable', 'integer', 'min:0', 'max:5000000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'kind' => ['nullable', Rule::enum(MachineKind::class)],
            'category' => ['sometimes', Rule::enum(VehicleCategory::class)],
            'cylinders' => ['nullable', 'integer', 'min:1', 'max:16'],
            'displacement_l' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'fuel' => ['nullable', 'string', 'max:40'],
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
            'vin.unique' => __('Another vehicle already has this VIN.'),
        ];
    }
}
