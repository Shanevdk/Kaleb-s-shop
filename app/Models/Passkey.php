<?php

namespace App\Models;

use App\Providers\AppServiceProvider;
use Laravel\Passkeys\Passkey as BasePasskey;
use MongoDB\Laravel\Eloquent\DocumentModel;

/**
 * Stores passkeys as MongoDB documents rather than rows. Registered on the
 * passkeys package in {@see AppServiceProvider}.
 */
class Passkey extends BasePasskey
{
    use DocumentModel;

    /**
     * The primary key type.
     *
     * @var string
     */
    protected $keyType = 'string';

    /**
     * The collection the passkeys are stored in.
     *
     * @var string
     */
    protected $table = 'passkeys';
}
