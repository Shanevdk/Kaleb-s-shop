<?php

namespace App\Http\Requests;

use App\Models\Equipment;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class EquipmentPhotoRequest extends FormRequest
{
    /**
     * How many photos can be added in one go.
     */
    private const MAX_PER_UPLOAD = 10;

    /**
     * Determine if the user is authorized to make this request.
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
            'photos' => ['required', 'array', 'max:'.self::MAX_PER_UPLOAD],
            'photos.*' => ['image', 'max:15360'],
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
            'photos.required' => __('Pick at least one photo.'),
            'photos.max' => __('Add up to :max photos at a time.', ['max' => self::MAX_PER_UPLOAD]),
            'photos.*.image' => __('Only photos can be added.'),
            'photos.*.max' => __('Each photo must be under 15 MB.'),
        ];
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
                /** @var Equipment $equipment */
                $equipment = $this->route('equipment');
                $room = Equipment::MAX_PHOTOS - count($equipment->photos ?? []);

                if (count((array) $this->file('photos', [])) <= $room) {
                    return;
                }

                $validator->errors()->add('photos', $room <= 0
                    ? __('It already has :max photos. Remove one to add another.', ['max' => Equipment::MAX_PHOTOS])
                    : __('There is only room for :room more.', ['room' => $room]));
            },
        ];
    }
}
