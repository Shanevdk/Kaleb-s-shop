<?php

namespace App\Http\Requests;

use App\Enums\ChecklistTemplate;
use App\Models\Vehicle;
use App\Rules\DocumentExists;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InspectionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
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
            'vehicle_id' => [
                'required',
                new DocumentExists(Vehicle::class, ['user_id' => $this->user()->id]),
            ],
            'template' => ['required', Rule::enum(ChecklistTemplate::class)],
            'performed_on' => ['required', 'date'],
            'odometer' => ['nullable', 'integer', 'min:0', 'max:5000000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
