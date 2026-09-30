<?php

namespace App\Http\Controllers;

use App\Actions\PlanInspectionSchedule;
use App\Models\ClosedDay;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ClosedDayController extends Controller
{
    /**
     * Mark a day the shop is shut, and move the checks the planner had put on
     * it to another day.
     */
    public function store(Request $request, PlanInspectionSchedule $planSchedule): RedirectResponse
    {
        $validated = $request->validate([
            'date' => [
                'required',
                'date_format:Y-m-d',
                Rule::unique('closed_days', 'date'),
                function (string $attribute, mixed $value, Closure $fail): void {
                    $day = CarbonImmutable::createFromFormat('!Y-m-d', (string) $value);

                    if ($day !== null && ! ClosedDay::isOpenOn($day, ClosedDay::between($day, $day))) {
                        $fail(__('The shop is already closed that day.'));
                    }
                },
            ],
            'reason' => ['required', 'string', 'max:80'],
        ]);

        $closedDay = new ClosedDay($validated);
        $closedDay->user()->associate($request->user());
        $closedDay->save();

        $planSchedule->handle($closedDay->date);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':date marked as closed.', [
            'date' => $closedDay->date->format('D j M'),
        ])]);

        return back();
    }

    /**
     * Open the shop again on a day that was marked closed.
     */
    public function destroy(ClosedDay $closedDay): RedirectResponse
    {
        $closedDay->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':date is open again.', [
            'date' => $closedDay->date->format('D j M'),
        ])]);

        return back();
    }
}
