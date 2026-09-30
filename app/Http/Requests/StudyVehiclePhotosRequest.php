<?php

namespace App\Http\Requests;

use App\Models\Vehicle;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StudyVehiclePhotosRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('vehicle'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [];
    }

    /**
     * Get the "after" validation callables for the request.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Vehicle $vehicle */
                $vehicle = $this->route('vehicle');

                if ($vehicle->photosToStudy() === []) {
                    $validator->errors()->add('photos', __('Take at least one photo of the outside first.'));
                }
            },
        ];
    }
}
