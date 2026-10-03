<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * They start out pending and get nothing until an administrator accepts
     * them from the Team page. Force created rather than mass assigned:
     * `status` is deliberately left out of the model's fillable list.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return User::forceCreate([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'status' => AccountStatus::Pending,
        ]);
    }
}
