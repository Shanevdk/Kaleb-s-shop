<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\InspectionItemController;
use App\Http\Controllers\InventoryItemController;
use App\Http\Controllers\InventoryScanController;
use App\Http\Controllers\ServiceRecordController;
use App\Http\Controllers\ShoppingListController;
use App\Http\Controllers\VehicleController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

/**
 * The web app manifest, served from a route so the installed app's name always
 * tracks APP_NAME rather than drifting in a checked-in static file.
 */
Route::get('site.webmanifest', function () {
    $name = (string) config('app.name');

    return response()->json([
        'name' => $name,
        'short_name' => $name,
        'description' => 'Workshop service log, checklists and parts inventory.',
        'start_url' => '/dashboard',
        'scope' => '/',
        'display' => 'standalone',
        'orientation' => 'portrait',
        'background_color' => '#171717',
        'theme_color' => '#171717',
        'icons' => [
            ['src' => '/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
    ])->withHeaders(['Content-Type' => 'application/manifest+json']);
})->name('manifest');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::inertia('assistant', 'assistant')->name('assistant');

    Route::resource('vehicles', VehicleController::class);
    Route::resource('service-records', ServiceRecordController::class)->except('show');

    Route::get('shopping-list', [ShoppingListController::class, 'index'])->name('shopping-list.index');

    Route::resource('inspections', InspectionController::class)->except('edit');
    Route::patch('inspection-items/{inspectionItem}', [InspectionItemController::class, 'update'])
        ->name('inspection-items.update');

    Route::get('inventory/scan', [InventoryScanController::class, 'create'])->name('inventory.scan');
    Route::post('inventory/scan', [InventoryScanController::class, 'store'])->name('inventory.scan.store');
    Route::post('inventory/scan/link', [InventoryScanController::class, 'link'])->name('inventory.scan.link');

    Route::patch('inventory/{inventory_item}/adjust', [InventoryItemController::class, 'adjust'])
        ->name('inventory.adjust');
    Route::resource('inventory', InventoryItemController::class)
        ->parameters(['inventory' => 'inventory_item'])
        ->except('show');
});

require __DIR__.'/settings.php';
