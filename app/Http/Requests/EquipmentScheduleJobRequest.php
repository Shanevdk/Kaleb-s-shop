<?php

namespace App\Http\Requests;

use App\Enums\EquipmentServiceType;
use App\Models\Equipment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EquipmentScheduleJobRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request. Maintenance
     * lands on the schedule of the division its equipment belongs to, which
     * takes that division's permission; equipment that does not exist is
     * left for validation to turn down.
     */
    public function authorize(): bool
    {
        $equipmentId = $this->input('equipment_id');
        $equipment = is_string($equipmentId) ? Equipment::query()->find($equipmentId) : null;

        return $equipment === null || $this->user()->can('update', $equipment);
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
            'days' => ['required', 'array', 'min:1', 'max:31'],
            'days.*' => ['required', 'date', 'distinct'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * A single day may still be sent on its own as performed_on.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->has('days') && $this->filled('performed_on')) {
            $this->merge(['days' => [$this->input('performed_on')]]);
        }
    }
}
