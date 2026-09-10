<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Translation\PotentiallyTranslatedString;

/**
 * Check that a value is the id of an existing document, optionally narrowed to
 * the ones matching some other fields.
 *
 * Laravel's `exists` rule cannot do this on MongoDB: its presence verifier
 * matches the key with a case-insensitive regular expression, which never
 * matches an ObjectId.
 */
class DocumentExists implements ValidationRule
{
    /**
     * @param  class-string<Model>  $model
     * @param  array<string, mixed>  $constraints
     */
    public function __construct(
        private string $model,
        private array $constraints = [],
    ) {}

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match('/^[0-9a-f]{24}$/i', $value) !== 1) {
            $fail('validation.exists')->translate();

            return;
        }

        $exists = $this->model::query()
            ->where($this->constraints)
            ->whereKey($value)
            ->exists();

        if (! $exists) {
            $fail('validation.exists')->translate();
        }
    }
}
