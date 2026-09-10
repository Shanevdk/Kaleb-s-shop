<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Determine whether the given filter value looks like a document id, so a
     * hand-edited query string cannot reach the database as a filter.
     */
    protected function isDocumentId(string $value): bool
    {
        return preg_match('/^[0-9a-f]{24}$/i', $value) === 1;
    }
}
