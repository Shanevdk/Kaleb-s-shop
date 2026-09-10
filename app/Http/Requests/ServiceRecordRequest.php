<?php

namespace App\Http\Requests;

use App\Enums\ServiceStatus;
use App\Enums\ServiceType;
use App\Enums\UnitOfMeasure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRecordRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $serviceRecord = $this->route('service_record');

        return $serviceRecord === null || $this->user()->can('update', $serviceRecord);
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
                Rule::exists('vehicles', 'id')->where('user_id', $this->user()->id),
            ],
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(ServiceType::class)],
            'status' => ['required', Rule::enum(ServiceStatus::class)],
            'performed_on' => ['required', 'date'],
            'odometer' => ['nullable', 'integer', 'min:0', 'max:5000000'],
            'hours' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'parts_cost' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'labour_cost' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'description' => ['nullable', 'string', 'max:5000'],
            'parts' => ['nullable', 'array', 'max:100'],
            'parts.*.id' => [
                'nullable',
                'string',
                Rule::exists('service_record_parts', 'id')
                    ->where('service_record_id', $this->route('service_record')?->id),
            ],
            'parts.*.name' => ['required', 'string', 'max:120'],
            'parts.*.inventory_item_id' => [
                'nullable',
                Rule::exists('inventory_items', 'id')->where('user_id', $this->user()->id),
            ],
            'parts.*.quantity' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'parts.*.unit' => ['nullable', Rule::enum(UnitOfMeasure::class)],
        ];
    }

    /**
     * Get the attributes that belong on the service record itself.
     *
     * @return array<string, mixed>
     */
    public function recordAttributes(): array
    {
        return $this->safe()->except('parts');
    }

    /**
     * Get the parts the job calls for, normalised into rows.
     *
     * @return array<int, array{id: string|null, inventory_item_id: string|null, name: string, quantity: float, unit: string}>
     */
    public function parts(): array
    {
        return array_map(fn (array $part): array => [
            'id' => isset($part['id']) ? (string) $part['id'] : null,
            'inventory_item_id' => isset($part['inventory_item_id']) ? (string) $part['inventory_item_id'] : null,
            'name' => $part['name'],
            'quantity' => (float) ($part['quantity'] ?? 1) ?: 1,
            'unit' => $part['unit'] ?? UnitOfMeasure::Each->value,
        ], $this->validated('parts', []));
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'hours' => $this->input('hours') ?: 0,
            'parts_cost' => $this->input('parts_cost') ?: 0,
            'labour_cost' => $this->input('labour_cost') ?: 0,
        ]);
    }
}
