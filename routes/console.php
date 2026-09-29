<?php

use App\Actions\PlanInspectionSchedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('inspections:plan {--months=2 : How many months to plan, starting with this one}', function (PlanInspectionSchedule $planSchedule) {
    $months = max(1, (int) $this->option('months'));

    for ($offset = 0; $offset < $months; $offset++) {
        $month = today()->startOfMonth()->addMonths($offset);
        $planSchedule->handle($month);
        $this->info("Planned {$month->format('F Y')}.");
    }
})->purpose('Book every vehicle in for its monthly check and annual inspection');

Schedule::command('inspections:plan')->dailyAt('05:00');
