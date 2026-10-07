<?php

namespace App\Http\Requests;

use App\Concerns\ValidatesBookedDays;
use App\Enums\EquipmentServiceType;
use App\Models\Equipment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EquipmentScheduleJobRequest extends FormRequest
{
    use ValidatesBookedDays;

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
            ...self::bookedDaysRules(),
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->mergeBookedDays($this);
    }
}
