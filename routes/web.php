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
