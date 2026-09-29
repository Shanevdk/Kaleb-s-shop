<?php

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DiagnosisController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\InspectionItemController;
use App\Http\Controllers\InventoryItemController;
use App\Http\Controllers\InventoryScanController;
use App\Http\Controllers\LookupController;
use App\Http\Controllers\PartOrderController;
use App\Http\Controllers\PlannedInspectionController;
use App\Http\Controllers\ReceivingController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\ScheduleJobController;
use App\Http\Controllers\ServiceRecordController;
use App\Http\Controllers\ShoppingListController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\VehiclePhotoController;
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
        'background_color' => '#001f4f',
        'theme_color' => '#001f4f',
        'icons' => [
            ['src' => '/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
    ])->withHeaders(['Content-Type' => 'application/manifest+json']);
})->name('manifest');

Route::middleware(['auth', 'verified', 'can:manage-team'])->group(function () {
    Route::post('admin/users/{user}/verify', [UserController::class, 'verify'])
        ->name('admin.users.verify');

    Route::resource('admin/users', UserController::class)
        ->only(['index', 'create', 'store', 'update', 'destroy'])
        ->names('admin.users')
        ->parameters(['users' => 'user']);
});

// Everyone on the team, shoppers included.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('shopping-list', [ShoppingListController::class, 'index'])->name('shopping-list.index');
    Route::post('shopping-list/orders', [PartOrderController::class, 'store'])->name('shopping-list.orders.store');
    Route::delete('shopping-list/orders/{partOrder}', [PartOrderController::class, 'destroy'])
        ->name('shopping-list.orders.destroy');
});

// Everyone but shoppers, schedulers included.
Route::middleware(['auth', 'verified', 'can:manage-schedule'])->group(function () {
    Route::get('schedule', [ScheduleController::class, 'index'])->name('schedule.index');
    Route::patch('schedule/checks/{plannedInspection}', [PlannedInspectionController::class, 'update'])
        ->name('schedule.checks.update');
    Route::post('schedule/jobs', [ScheduleJobController::class, 'store'])->name('schedule.jobs.store');
    Route::patch('schedule/jobs/{serviceRecord}', [ScheduleJobController::class, 'update'])
        ->name('schedule.jobs.update');
    Route::delete('schedule/jobs/{serviceRecord}', [ScheduleJobController::class, 'destroy'])
        ->name('schedule.jobs.destroy');
});

Route::middleware(['auth', 'verified', 'can:work-on-records'])->group(function () {
    Route::get('assistant', [AssistantController::class, 'show'])->name('assistant');
    Route::post('assistant', [AssistantController::class, 'ask'])
        ->middleware('throttle:10,1')
        ->name('assistant.ask');

    Route::get('lookup', [LookupController::class, 'index'])->name('lookup');
    Route::get('lookup/decode', [LookupController::class, 'decode'])->name('lookup.decode');

    Route::get('diagnose', [DiagnosisController::class, 'show'])->name('diagnose');
    Route::post('diagnose', [DiagnosisController::class, 'diagnose'])
        ->middleware('throttle:10,1')
        ->name('diagnose.run');

    Route::post('vehicles/{vehicle}/photos/{angle}', [VehiclePhotoController::class, 'store'])
        ->name('vehicles.photos.store');
    Route::delete('vehicles/{vehicle}/photos/{angle}', [VehiclePhotoController::class, 'destroy'])
        ->name('vehicles.photos.destroy');
    Route::resource('vehicles', VehicleController::class);
    Route::resource('service-records', ServiceRecordController::class)->except('show');

    Route::resource('inspections', InspectionController::class)->except('edit');
    Route::patch('inspection-items/{inspectionItem}', [InspectionItemController::class, 'update'])
        ->name('inspection-items.update');
    Route::post('inspection-items/{inspectionItem}/replan', [InspectionItemController::class, 'replan'])
        ->middleware('throttle:10,1')
        ->name('inspection-items.replan');

    Route::get('inventory/scan', [InventoryScanController::class, 'create'])->name('inventory.scan');
    Route::post('inventory/scan', [InventoryScanController::class, 'store'])->name('inventory.scan.store');
    Route::post('inventory/scan/link', [InventoryScanController::class, 'link'])->name('inventory.scan.link');

    Route::get('receiving', [ReceivingController::class, 'index'])->name('receiving.index');
    Route::get('receiving/decode', [ReceivingController::class, 'decode'])->name('receiving.decode');
    Route::post('receiving/{partOrder}', [ReceivingController::class, 'store'])->name('receiving.store');

    Route::patch('inventory/{inventory_item}/adjust', [InventoryItemController::class, 'adjust'])
        ->name('inventory.adjust');
    Route::put('inventory/{inventory_item}/barcode', [InventoryItemController::class, 'assignBarcode'])
        ->name('inventory.barcode');
    Route::resource('inventory', InventoryItemController::class)
        ->parameters(['inventory' => 'inventory_item'])
        ->except('show');
});

require __DIR__.'/settings.php';
