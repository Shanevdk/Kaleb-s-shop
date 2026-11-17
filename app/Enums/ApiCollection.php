<?php

namespace App\Enums;

use App\Models\ClosedDay;
use App\Models\Equipment;
use App\Models\EquipmentChecklist;
use App\Models\EquipmentChecklistItem;
use App\Models\EquipmentServiceRecord;
use App\Models\Feedback;
use App\Models\Fitment;
use App\Models\Inspection;
use App\Models\InspectionItem;
use App\Models\InventoryItem;
use App\Models\PartOrder;
use App\Models\PlannedInspection;
use App\Models\ServiceRecord;
use App\Models\ServiceRecordPart;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleChecklistChange;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Each kind of record another app can read through the API with a key, and
 * the fields of it that go out. Fields are listed one by one, so a column
 * added later stays private until it is added here, and nothing that signs
 * someone in or opens a private link (passwords, two-factor secrets, work
 * order keys) is ever shared.
 */
enum ApiCollection: string
{
    case Users = 'users';
    case Vehicles = 'vehicles';
    case Inspections = 'inspections';
    case InspectionItems = 'inspection_items';
    case VehicleChecklistChanges = 'vehicle_checklist_changes';
    case PlannedInspections = 'planned_inspections';
    case ClosedDays = 'closed_days';
    case ServiceRecords = 'service_records';
    case ServiceRecordParts = 'service_record_parts';
    case InventoryItems = 'inventory_items';
    case Fitments = 'fitments';
    case StockMovements = 'stock_movements';
    case PartOrders = 'part_orders';
    case Equipment = 'equipment';
    case EquipmentChecklists = 'equipment_checklists';
    case EquipmentChecklistItems = 'equipment_checklist_items';
    case EquipmentServiceRecords = 'equipment_service_records';
    case Feedback = 'feedback';

    /**
     * Find the collection a record belongs to.
     */
    public static function forRecord(Model $record): self
    {
        foreach (self::cases() as $collection) {
            if ($record::class === $collection->model()) {
                return $collection;
            }
        }

        throw new InvalidArgumentException('['.$record::class.'] is not shared through the API.');
    }

    /**
     * Get the model the collection's records are.
     *
     * @return class-string<Model>
     */
    public function model(): string
    {
        return match ($this) {
            self::Users => User::class,
            self::Vehicles => Vehicle::class,
            self::Inspections => Inspection::class,
            self::InspectionItems => InspectionItem::class,
            self::VehicleChecklistChanges => VehicleChecklistChange::class,
            self::PlannedInspections => PlannedInspection::class,
            self::ClosedDays => ClosedDay::class,
            self::ServiceRecords => ServiceRecord::class,
            self::ServiceRecordParts => ServiceRecordPart::class,
            self::InventoryItems => InventoryItem::class,
            self::Fitments => Fitment::class,
            self::StockMovements => StockMovement::class,
            self::PartOrders => PartOrder::class,
            self::Equipment => Equipment::class,
            self::EquipmentChecklists => EquipmentChecklist::class,
            self::EquipmentChecklistItems => EquipmentChecklistItem::class,
            self::EquipmentServiceRecords => EquipmentServiceRecord::class,
            self::Feedback => Feedback::class,
        };
    }

    /**
     * Get the fields shared for each record, besides its id and when it was
     * made and last changed. Photos go out as links, not as stored paths.
     *
     * @return array<int, string>
     */
    public function fields(): array
    {
        return match ($this) {
            self::Users => ['name', 'email', 'role', 'permissions'],
            self::Vehicles => [
                'user_id', 'make', 'model', 'year', 'nickname', 'registration', 'vin', 'colour', 'odometer',
                'notes', 'kind', 'category', 'location', 'specs', 'look',
            ],
            self::Inspections => ['user_id', 'vehicle_id', 'template', 'title', 'performed_on', 'odometer', 'notes', 'completed_at'],
            self::InspectionItems => ['inspection_id', 'section', 'label', 'status', 'notes', 'parts_status', 'parts_requested_at', 'position'],
            self::VehicleChecklistChanges => ['vehicle_id', 'template', 'section', 'label', 'action'],
            self::PlannedInspections => ['vehicle_id', 'template', 'period', 'due_on', 'pinned', 'skipped'],
            self::ClosedDays => ['user_id', 'date', 'reason'],
            self::ServiceRecords => [
                'user_id', 'vehicle_id', 'inspection_item_id', 'title', 'type', 'status', 'performed_on',
                'scheduled_days', 'finishes_on', 'odometer', 'hours', 'parts_cost', 'labour_cost', 'description',
                'issue_reason', 'quoted_price', 'estimate_status', 'estimate_requested_at', 'estimated_hours',
                'estimated_hours_low', 'estimated_hours_high', 'estimate_reasoning', 'estimated_at',
            ],
            self::ServiceRecordParts => [
                'service_record_id', 'inventory_item_id', 'name', 'quantity', 'unit', 'quantity_taken', 'estimated_unit_cost',
            ],
            self::InventoryItems => [
                'user_id', 'name', 'category', 'unit', 'part_number', 'barcode', 'brand', 'supplier', 'location',
                'quantity', 'minimum_quantity', 'unit_cost', 'notes',
            ],
            self::Fitments => ['inventory_item_id', 'vehicle_id', 'quantity_needed', 'notes'],
            self::StockMovements => ['user_id', 'inventory_item_id', 'vehicle_id', 'service_record_id', 'quantity', 'note'],
            self::PartOrders => [
                'user_id', 'inventory_item_id', 'name', 'part_number', 'brand', 'supplier', 'unit',
                'quantity_ordered', 'quantity_received', 'received_by', 'received_at',
            ],
            self::Equipment => [
                'user_id', 'division', 'name', 'category', 'serial_number', 'barcode', 'location', 'status',
                'purchased_on', 'notes', 'default_checklist_id',
            ],
            self::EquipmentChecklists => ['user_id', 'equipment_id', 'title', 'performed_on', 'notes', 'completed_at'],
            self::EquipmentChecklistItems => ['equipment_checklist_id', 'label', 'status', 'notes', 'position'],
            self::EquipmentServiceRecords => [
                'user_id', 'division', 'equipment_id', 'title', 'type', 'status', 'performed_on', 'scheduled_days',
                'finishes_on', 'hours', 'parts_cost', 'labour_cost', 'description',
            ],
            self::Feedback => ['user_id', 'message', 'page', 'resolved_at'],
        };
    }
}
