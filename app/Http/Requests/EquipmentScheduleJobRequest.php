<?php

namespace App\Http\Requests;

use App\Enums\EquipmentServiceType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EquipmentScheduleJobRequest extends FormRequest
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
            'equipment_id' => ['required', 'string', Rule::exists('equipment', 'id')],
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(EquipmentServiceType::class)],
            'performed_on' => ['required', 'date'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
