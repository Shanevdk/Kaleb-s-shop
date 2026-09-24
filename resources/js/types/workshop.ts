export type MachineKind =
    | 'car'
    | 'ute'
    | 'suv'
    | 'van'
    | 'truck'
    | 'bus'
    | 'motorcycle'
    | 'atv'
    | 'tractor'
    | 'mower'
    | 'outboard'
    | 'generator'
    | 'trailer'
    | 'other';

export type EngineSpecs = {
    cylinders: number | null;
    displacement_l: number | null;
    configuration: string | null;
    fuel: string | null;
    horsepower: number | null;
    kilowatts?: number | null;
    model?: string | null;
    manufacturer?: string | null;
    turbo?: boolean | null;
    valve_train?: string | null;
};

export type MachineSpecs = {
    source: 'nhtsa' | 'manual';
    vin?: string;
    decoded_at?: string;
    kind?: MachineKind;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    trim?: string | null;
    series?: string | null;
    body_class?: string | null;
    vehicle_type?: string | null;
    doors?: number | null;
    drive_type?: string | null;
    transmission?: string | null;
    gvwr?: string | null;
    manufacturer?: string | null;
    plant?: string | null;
    engine: Partial<EngineSpecs>;
    warnings?: string | null;
};

export type MaintenanceInterval = {
    interval: string;
    items: string[];
};

export type CommonRepair = {
    symptom: string;
    causes: string[];
    fix: string;
};

export type PhotoAngle =
    | 'front'
    | 'front_right'
    | 'right'
    | 'rear_right'
    | 'rear'
    | 'rear_left'
    | 'left'
    | 'front_left'
    | 'top'
    | 'engine';

export type PhotoAngleOption = {
    value: PhotoAngle;
    label: string;
    hint: string;
    degrees: number | null;
};

export type VehiclePhotos = Partial<Record<PhotoAngle, string>>;

export type Recall = {
    campaign: string;
    date: string | null;
    component: string | null;
    summary: string | null;
    consequence: string | null;
    remedy: string | null;
};

export type Vehicle = {
    id: string;
    make: string;
    model: string;
    year: number;
    nickname: string | null;
    registration: string | null;
    vin: string | null;
    colour: string | null;
    odometer: number | null;
    notes: string | null;
    display_name: string;
    kind: MachineKind;
    kind_label: string;
    specs: MachineSpecs | null;
    engine: EngineSpecs;
    engine_summary: string | null;
    photos: VehiclePhotos;
    service_records_count?: number;
    spend?: number;
    last_serviced_on?: string | null;
};

export type ServiceStatus = 'planned' | 'in_progress' | 'completed';

export type ServiceRecord = {
    id: string;
    vehicle_id: string;
    title: string;
    type: string;
    type_label: string;
    status: ServiceStatus;
    status_label: string;
    performed_on: string;
    odometer: number | null;
    hours: number;
    parts_cost: number;
    labour_cost: number;
    total_cost: number;
    description: string | null;
    parts?: ServiceRecordPart[];
    vehicle?: {
        id: string;
        display_name: string;
        registration: string | null;
    };
};

export type SelectOption = {
    value: string;
    label: string;
};

export type UnitOption = SelectOption & {
    abbreviation: string;
    is_measured: boolean;
    step: number;
    quick_amounts: number[];
};

export type CheckStatus = 'pending' | 'good' | 'attention' | 'fixed';

export type InspectionItem = {
    id: string;
    section: string;
    label: string;
    status: CheckStatus;
    status_label: string;
    notes: string | null;
    position: number;
};

export type Inspection = {
    id: string;
    vehicle_id: string;
    template: string;
    template_label: string;
    title: string;
    performed_on: string;
    odometer: number | null;
    notes: string | null;
    is_complete: boolean;
    checked_count?: number;
    flagged_count?: number;
    fixed_count?: number;
    items_count?: number;
    items?: InspectionItem[];
    vehicle?: {
        id: string;
        display_name: string;
        registration: string | null;
    };
};

export type ChecklistTemplate = {
    value: string;
    label: string;
    description: string;
    item_count: number;
};

export type Fitment = {
    id: string;
    display_name: string;
    registration: string | null;
    quantity_needed: number;
    notes: string | null;
};

export type InventoryItem = {
    id: string;
    name: string;
    category: string;
    category_label: string;
    unit: string;
    unit_label: string;
    unit_abbreviation: string;
    unit_step: number;
    quick_amounts: number[];
    is_measured: boolean;
    part_number: string | null;
    barcode: string | null;
    brand: string | null;
    supplier: string | null;
    location: string | null;
    quantity: number;
    minimum_quantity: number;
    unit_cost: number;
    stock_value: number;
    is_low_stock: boolean;
    image_url: string | null;
    notes: string | null;
    vehicles?: Fitment[];
};

export type VehiclePart = InventoryItem & {
    quantity_needed: number;
    fitment_notes: string | null;
    shortfall: number;
};

export type FitmentOption = {
    id: string;
    display_name: string;
    registration: string | null;
};

export type ServiceRecordPart = {
    id: string;
    service_record_id: string;
    inventory_item_id: string | null;
    name: string;
    quantity: number;
    unit: string;
    unit_abbreviation: string;
    quantity_taken: number;
    quantity_outstanding: number;
    shortfall: number;
    on_hand?: number | null;
};

export type StockedPart = {
    id: string;
    name: string;
    part_number: string | null;
    unit: string;
    unit_abbreviation: string;
    quantity: number;
    fits: { vehicle_id: string; quantity_needed: number }[];
};

export type ShoppingListLine = {
    inventory_item_id: string | null;
    in_inventory?: boolean;
    name: string;
    part_number: string | null;
    brand: string | null;
    supplier: string | null;
    unit_abbreviation: string;
    on_hand: number;
    minimum_quantity?: number;
    required?: number;
    shortfall: number;
    unit_cost: number;
    estimated_cost: number;
    jobs?: { id: string; title: string; vehicle: string | null }[];
};
