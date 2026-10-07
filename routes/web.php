<?php

use App\Enums\EquipmentDivision;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\ClosedDayController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DiagnosisController;
use App\Http\Controllers\EquipmentChecklistController;
use App\Http\Controllers\EquipmentChecklistItemController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\EquipmentJobQueueController;
use App\Http\Controllers\EquipmentScheduleController;
use App\Http\Controllers\EquipmentScheduleJobController;
use App\Http\Controllers\EquipmentServiceRecordController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\InspectionItemController;
use App\Http\Controllers\InventoryItemController;
use App\Http\Controllers\InventoryScanController;
use App\Http\Controllers\JobQueueController;
use App\Http\Controllers\LookupController;
use App\Http\Controllers\PartOrderController;
use App\Http\Controllers\PhoneScannerController;
use App\Http\Controllers\PlannedInspectionController;
use App\Http\Controllers\ReceivingController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\ScheduleJobController;
use App\Http\Controllers\ScreenSaverDataController;
use App\Http\Controllers\ServiceRecordController;
use App\Http\Controllers\ServiceRecordEstimateController;
use App\Http\Controllers\ShoppingListController;
use App\Http\Controllers\VehicleChecklistChangeController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\VehicleLookController;
use App\Http\Controllers\VehiclePhotoController;
use App\Http\Controllers\WorkOrderController;
use App\Models\Equipment;
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
        'background_color' => '#2b2b2b',
        'theme_color' => '#001f4f',
        'icons' => [
            ['src' => '/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
    ])->withHeaders(['Content-Type' => 'application/manifest+json']);
})->name('manifest');

/**
 * A phone lending its camera to a computer. The phone needs no login: the
 * links are signed and short lived, and only ever add scanned codes.
 */
Route::get('phone-scanner/{token}', [PhoneScannerController::class, 'show'])
    ->middleware('signed')
    ->name('phone-scanner.show');
Route::post('phone-scanner/{token}/scans', [PhoneScannerController::class, 'scan'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('phone-scanner.scan');

/**
 * A job's work order, to share. No login needed: the link is signed
 * and only shows the job it was made for.
 */
Route::get('work-orders/{serviceRecord}', [WorkOrderController::class, 'show'])
    ->middleware('signed')
    ->name('work-orders.show');

Route::middleware(['auth', 'verified', 'can:manage-team'])->group(function () {
    Route::post('admin/users/{user}/verify', [UserController::class, 'verify'])
        ->name('admin.users.verify');

    Route::patch('admin/users/{user}/permissions', [UserController::class, 'updatePermissions'])
        ->name('admin.users.permissions.update');

    Route::resource('admin/users', UserController::class)
        ->only(['index', 'create', 'store', 'update', 'destroy'])
        ->names('admin.users')
        ->parameters(['users' => 'user']);
});

// Everyone on the team: the landing page and its data feed need no
// permission of their own.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('screen-saver/data', [ScreenSaverDataController::class, 'index'])->name('screen-saver.data');
});

Route::middleware(['auth', 'verified', 'can:shopping-list'])->group(function () {
    Route::get('shopping-list', [ShoppingListController::class, 'index'])->name('shopping-list.index');
    Route::post('shopping-list/orders', [PartOrderController::class, 'store'])->name('shopping-list.orders.store');
    Route::delete('shopping-list/orders/{partOrder}', [PartOrderController::class, 'destroy'])
        ->name('shopping-list.orders.destroy');
});

Route::middleware(['auth', 'verified', 'can:schedule'])->group(function () {
    Route::get('schedule', [ScheduleController::class, 'index'])->name('schedule.index');
    Route::patch('schedule/checks/{plannedInspection}', [PlannedInspectionController::class, 'update'])
        ->name('schedule.checks.update');
    Route::delete('schedule/checks/{plannedInspection}', [PlannedInspectionController::class, 'destroy'])
        ->name('schedule.checks.destroy');
    Route::post('schedule/jobs', [ScheduleJobController::class, 'store'])->name('schedule.jobs.store');
    Route::patch('schedule/jobs/{serviceRecord}', [ScheduleJobController::class, 'update'])
        ->name('schedule.jobs.update');
    Route::delete('schedule/jobs/{serviceRecord}', [ScheduleJobController::class, 'destroy'])
        ->name('schedule.jobs.destroy');
    Route::post('schedule/closed-days', [ClosedDayController::class, 'store'])->name('schedule.closed-days.store');
    Route::delete('schedule/closed-days/{closedDay}', [ClosedDayController::class, 'destroy'])
        ->name('schedule.closed-days.destroy');
});

Route::middleware(['auth', 'verified', 'can:assistant'])->group(function () {
    Route::get('assistant', [AssistantController::class, 'show'])->name('assistant');
    Route::post('assistant', [AssistantController::class, 'ask'])
        ->middleware('throttle:10,1')
        ->name('assistant.ask');
});

Route::middleware(['auth', 'verified', 'can:lookup'])->group(function () {
    Route::get('lookup', [LookupController::class, 'index'])->name('lookup');
    Route::get('lookup/decode', [LookupController::class, 'decode'])->name('lookup.decode');
});

Route::middleware(['auth', 'verified', 'can:diagnose'])->group(function () {
    Route::get('diagnose', [DiagnosisController::class, 'show'])->name('diagnose');
    Route::post('diagnose', [DiagnosisController::class, 'diagnose'])
        ->middleware('throttle:10,1')
        ->name('diagnose.run');
});

Route::middleware(['auth', 'verified', 'can:vehicles'])->group(function () {
    Route::post('vehicles/{vehicle}/photos/{angle}', [VehiclePhotoController::class, 'store'])
        ->name('vehicles.photos.store');
    Route::delete('vehicles/{vehicle}/photos/{angle}', [VehiclePhotoController::class, 'destroy'])
        ->name('vehicles.photos.destroy');
    Route::post('vehicles/{vehicle}/look', [VehicleLookController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('vehicles.look.store');
    Route::delete('vehicles/{vehicle}/look', [VehicleLookController::class, 'destroy'])
        ->name('vehicles.look.destroy');
    Route::resource('vehicles', VehicleController::class);
});

Route::middleware(['auth', 'verified', 'can:service-log'])->group(function () {
    Route::resource('service-records', ServiceRecordController::class);
    Route::post('service-records/{service_record}/estimate', [ServiceRecordEstimateController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('service-records.estimate.store');
    Route::put('service-records/{service_record}/work-order', [WorkOrderController::class, 'update'])
        ->middleware('throttle:10,1')
        ->name('service-records.work-order.update');
});

Route::middleware(['auth', 'verified', 'can:job-queue'])->group(function () {
    Route::get('job-queue', [JobQueueController::class, 'index'])->name('job-queue.index');
    Route::post('job-queue', [JobQueueController::class, 'store'])->name('job-queue.store');
    Route::patch('job-queue/{serviceRecord}', [JobQueueController::class, 'update'])->name('job-queue.update');
});

Route::middleware(['auth', 'verified', 'can:inspections'])->group(function () {
    Route::resource('inspections', InspectionController::class)->except('edit');
    Route::post('inspections/{inspection}/items', [InspectionItemController::class, 'store'])
        ->name('inspection-items.store');
    Route::patch('inspection-items/{inspectionItem}', [InspectionItemController::class, 'update'])
        ->name('inspection-items.update');
    Route::delete('inspection-items/{inspectionItem}', [InspectionItemController::class, 'destroy'])
        ->name('inspection-items.destroy');
    Route::delete('vehicles/{vehicle}/checklists/{template}', [VehicleChecklistChangeController::class, 'destroy'])
        ->name('vehicles.checklist-changes.destroy');
    Route::post('inspection-items/{inspectionItem}/replan', [InspectionItemController::class, 'replan'])
        ->middleware('throttle:10,1')
        ->name('inspection-items.replan');
});

// Barcode-via-phone pairing is only used from the inventory screens today.
Route::middleware(['auth', 'verified', 'can:inventory'])->group(function () {
    Route::post('phone-scanner', [PhoneScannerController::class, 'store'])
        ->middleware('throttle:20,1')
        ->name('phone-scanner.store');
    Route::get('phone-scanner/{token}/scans', [PhoneScannerController::class, 'poll'])
        ->name('phone-scanner.poll');

    Route::get('inventory/scan', [InventoryScanController::class, 'create'])->name('inventory.scan');
    Route::post('inventory/scan', [InventoryScanController::class, 'store'])->name('inventory.scan.store');
    Route::post('inventory/scan/link', [InventoryScanController::class, 'link'])->name('inventory.scan.link');

    Route::patch('inventory/{inventory_item}/adjust', [InventoryItemController::class, 'adjust'])
        ->name('inventory.adjust');
    Route::put('inventory/{inventory_item}/barcode', [InventoryItemController::class, 'assignBarcode'])
        ->name('inventory.barcode');
    Route::resource('inventory', InventoryItemController::class)
        ->parameters(['inventory' => 'inventory_item'])
        ->except('show');
});

Route::middleware(['auth', 'verified', 'can:receiving'])->group(function () {
    Route::get('receiving', [ReceivingController::class, 'index'])->name('receiving.index');
    Route::get('receiving/decode', [ReceivingController::class, 'decode'])->name('receiving.decode');
    Route::post('receiving/{partOrder}', [ReceivingController::class, 'store'])->name('receiving.store');
});

/**
 * Each equipment division keeps its own lists, unlocked by its own
 * permission: VDK-Equipment's at the top level and VDK Equipment USA's under
 * usa/. The division is handed to each controller as a route default.
 */
$equipmentLists = function (EquipmentDivision $division): void {
    Route::get('equipment', [EquipmentController::class, 'index'])
        ->name('equipment.index')
        ->defaults('division', $division->value);
    Route::get('equipment/create', [EquipmentController::class, 'create'])
        ->name('equipment.create')
        ->defaults('division', $division->value);
    Route::post('equipment', [EquipmentController::class, 'store'])
        ->name('equipment.store')
        ->defaults('division', $division->value);
    Route::get('equipment-checklists', [EquipmentChecklistController::class, 'index'])
        ->name('equipment-checklists.index')
        ->defaults('division', $division->value);
    Route::get('equipment-service-records', [EquipmentServiceRecordController::class, 'index'])
        ->name('equipment-service-records.index')
        ->defaults('division', $division->value);
    Route::get('equipment-schedule', [EquipmentScheduleController::class, 'index'])
        ->name('equipment-schedule.index')
        ->defaults('division', $division->value);
    Route::get('equipment-job-queue', [EquipmentJobQueueController::class, 'index'])
        ->name('equipment-job-queue.index')
        ->defaults('division', $division->value);
    Route::post('equipment-job-queue', [EquipmentJobQueueController::class, 'store'])
        ->name('equipment-job-queue.store')
        ->defaults('division', $division->value);
};

Route::middleware(['auth', 'verified', 'can:equipment'])
    ->group(fn () => $equipmentLists(EquipmentDivision::Main));

Route::middleware(['auth', 'verified', 'can:equipment-usa'])
    ->prefix('usa')
    ->name('usa.')
    ->group(fn () => $equipmentLists(EquipmentDivision::Usa));

// A piece of equipment, and everything logged against it, opens at the same
// address whichever division it belongs to. Each action checks the
// permission for that division.
Route::middleware(['auth', 'verified', 'can:viewAny,'.Equipment::class])->group(function () {
    Route::post('equipment/scan', [EquipmentController::class, 'scan'])
        ->name('equipment.scan');
    Route::resource('equipment', EquipmentController::class)->only(['show', 'edit', 'update', 'destroy']);
    Route::put('equipment/{equipment}/barcode', [EquipmentController::class, 'assignBarcode'])
        ->name('equipment.barcode');
    Route::post('equipment/{equipment}/checklists', [EquipmentChecklistController::class, 'store'])
        ->name('equipment-checklists.store');
    Route::get('equipment-checklists/{equipmentChecklist}', [EquipmentChecklistController::class, 'show'])
        ->name('equipment-checklists.show');
    Route::patch('equipment-checklists/{equipmentChecklist}', [EquipmentChecklistController::class, 'update'])
        ->name('equipment-checklists.update');
    Route::delete('equipment-checklists/{equipmentChecklist}', [EquipmentChecklistController::class, 'destroy'])
        ->name('equipment-checklists.destroy');
    Route::post('equipment-checklists/{equipmentChecklist}/items', [EquipmentChecklistItemController::class, 'store'])
        ->name('equipment-checklist-items.store');
    Route::patch('equipment-checklist-items/{equipmentChecklistItem}', [EquipmentChecklistItemController::class, 'update'])
        ->name('equipment-checklist-items.update');
    Route::delete('equipment-checklist-items/{equipmentChecklistItem}', [EquipmentChecklistItemController::class, 'destroy'])
        ->name('equipment-checklist-items.destroy');
    Route::post('equipment/{equipment}/service-records', [EquipmentServiceRecordController::class, 'store'])
        ->name('equipment-service-records.store');
    Route::patch('equipment-service-records/{equipmentServiceRecord}', [EquipmentServiceRecordController::class, 'update'])
        ->name('equipment-service-records.update');
    Route::delete('equipment-service-records/{equipmentServiceRecord}', [EquipmentServiceRecordController::class, 'destroy'])
        ->name('equipment-service-records.destroy');
    Route::post('equipment-schedule/jobs', [EquipmentScheduleJobController::class, 'store'])
        ->name('equipment-schedule.jobs.store');
    Route::patch('equipment-schedule/jobs/{equipmentServiceRecord}', [EquipmentScheduleJobController::class, 'update'])
        ->name('equipment-schedule.jobs.update');
    Route::delete('equipment-schedule/jobs/{equipmentServiceRecord}', [EquipmentScheduleJobController::class, 'destroy'])
        ->name('equipment-schedule.jobs.destroy');
    Route::patch('equipment-job-queue/{equipmentServiceRecord}', [EquipmentJobQueueController::class, 'update'])
        ->name('equipment-job-queue.update');
});

require __DIR__.'/settings.php';
