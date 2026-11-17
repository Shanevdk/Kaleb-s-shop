<?php

use App\Http\Controllers\Api\V1\DataController;
use App\Http\Middleware\AuthenticateApiKey;
use Illuminate\Support\Facades\Route;

/**
 * The shop's data for another app, read-only. Each request needs a key an
 * admin made on the API keys page, sent as "Authorization: Bearer <key>".
 */
Route::prefix('v1')
    ->name('api.v1.')
    ->middleware(['throttle:240,1,api', AuthenticateApiKey::class])
    ->group(function () {
        Route::get('/', [DataController::class, 'index'])->name('index');
        Route::get('export', [DataController::class, 'export'])->name('export');
        Route::get('{collection}', [DataController::class, 'records'])->name('records.index');
        Route::get('{collection}/{id}', [DataController::class, 'record'])->name('records.show');
    });
