<?php

namespace App\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Validates the days a job is booked on, sent as days[]. The same date
 * picked twice is not an error; booking the job drops the repeat.
 */
trait ValidatesBookedDays
{
    /**
     * Get the rules for the days a job is booked on.
     *
     * @return array<string, array<int, string>>
     */
    protected static function bookedDaysRules(bool $required = true): array
    {
        return [
            'days' => [$required ? 'required' : 'sometimes', 'array', 'min:1', 'max:31'],
            'days.*' => ['required', 'date'],
        ];
    }

    /**
     * Let a single day still be sent on its own as performed_on. A job
     * already booked over several days keeps its shape: the rest of its days
     * move with the first.
     *
     * @param  (Model&BooksDays)|null  $job
     */
    protected function mergeBookedDays(Request $request, ?Model $job = null): void
    {
        if ($request->has('days') || ! $request->filled('performed_on')) {
            return;
        }

        $day = (string) $request->input('performed_on');

        $request->merge(['days' => $job?->scheduled_days === null || strtotime($day) === false
            ? [$day]
            : $job->daysMovedBy($job->days()[0], $day)]);
    }
}
