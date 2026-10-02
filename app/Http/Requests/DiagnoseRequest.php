<?php

namespace App\Http\Requests;

use App\Enums\MachineKind;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DiagnoseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('diagnose');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * A shop vehicle brings its own make, model and year; anything else has
     * to be described.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'vehicle_id' => ['nullable', 'string', Rule::exists('vehicles', 'id')],
            'kind' => ['nullable', Rule::enum(MachineKind::class)],
            'make' => ['required_without:vehicle_id', 'nullable', 'string', 'max:60'],
            'model' => ['required_without:vehicle_id', 'nullable', 'string', 'max:60'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:'.(now()->year + 1)],
            'engine' => ['nullable', 'string', 'max:120'],
            'odometer' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'codes' => ['nullable', 'string', 'max:200'],
            'symptoms' => ['required', 'string', 'max:2000'],
            'conditions' => ['nullable', 'string', 'max:1000'],
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
            'make.required_without' => __('Pick a shop vehicle or type the make.'),
            'model.required_without' => __('Pick a shop vehicle or type the model.'),
            'symptoms.required' => __('Describe what it is doing.'),
        ];
    }
}
