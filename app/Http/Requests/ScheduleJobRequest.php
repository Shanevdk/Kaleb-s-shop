<?php

namespace App\Http\Requests;

use App\Concerns\ValidatesBookedDays;
use App\Enums\ServiceType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ScheduleJobRequest extends FormRequest
{
    use ValidatesBookedDays;

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
            'vehicle_id' => ['required', 'string', Rule::exists('vehicles', 'id')],
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(ServiceType::class)],
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
