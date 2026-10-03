<?php

namespace App\Concerns;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

trait ClampsRequestedMonth
{
    /**
     * Get the month asked for, kept within five years back and one ahead.
     */
    private function requestedMonth(Request $request, CarbonImmutable $today): CarbonImmutable
    {
        $requested = (string) $request->string('month');

        $month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $requested) === 1
            ? CarbonImmutable::createFromFormat('!Y-m', $requested)
            : $today;

        if ($month->lessThan($today->subYears(5)->startOfMonth()) || $month->greaterThan($today->addYear()->endOfMonth())) {
            $month = $today;
        }

        return $month->startOfMonth();
    }
}
