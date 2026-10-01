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

export type LookAccessory =
    | 'bull_bar'
    | 'nudge_bar'
    | 'roof_rack'
    | 'roof_rails'
    | 'ladder_rack'
    | 'tow_bar'
    | 'canopy'
    | 'tonneau_cover'
    | 'sports_bar'
    | 'snorkel'
    | 'side_steps'
    | 'spotlights'
    | 'light_bar'
    | 'mud_flaps'
    | 'sunroof'
    | 'rooftop_tent';

export type DamageArea =
    | 'front_bumper'
    | 'rear_bumper'
    | 'bonnet'
    | 'roof'
    | 'windscreen'
    | 'rear_window'
    | 'grille'
    | 'left_headlight'
    | 'right_headlight'
    | 'left_taillight'
    | 'right_taillight'
    | 'left_mirror'
    | 'right_mirror'
    | 'front_left_door'
    | 'front_right_door'
    | 'rear_left_door'
    | 'rear_right_door'
    | 'left_front_guard'
    | 'right_front_guard'
    | 'left_rear_quarter'
    | 'right_rear_quarter'
    | 'left_sill'
    | 'right_sill'
    | 'left_front_wheel'
    | 'right_front_wheel'
    | 'left_rear_wheel'
    | 'right_rear_wheel'
    | 'tailgate'
    | 'tray'
    | 'other';

export type LookDamage = {
    area: DamageArea;
    kind:
        | 'dent'
        | 'scratch'
        | 'scrape'
        | 'rust'
        | 'crack'
        | 'missing'
        | 'flat_tyre'
        | 'other';
    severity: 'minor' | 'moderate' | 'severe';
    note: string;
};

/**
 * What an AI made of the vehicle's photos, for matching its 3D model to
 * the real thing.
 */
export type VehicleLook = {
    colour: {
        name: string;
        hex: string | null;
        finish: 'solid' | 'metallic' | 'pearl' | 'matte';
    } | null;
    body_style:
        | 'sedan'
        | 'hatchback'
        | 'wagon'
        | 'coupe'
        | 'convertible'
        | 'suv'
        | 'ute'
        | 'van'
        | 'truck'
        | 'bus'
        | 'motorcycle'
        | 'other'
        | null;
    cab: 'single' | 'extra' | 'dual' | null;
    roof: 'standard' | 'high' | null;
    wheels: {
        style: 'steel' | 'hubcap' | 'alloy';
        spokes: number | null;
        colour:
            | 'silver'
            | 'black'
            | 'gunmetal'
            | 'bronze'
            | 'white'
            | 'chrome'
            | null;
    } | null;
    tinted_windows: boolean | null;
    accessories: LookAccessory[];
    damage: LookDamage[];
    summary: string | null;
    confidence: number | null;
    angles: PhotoAngle[];
    model: string | null;
    studied_at: string;
    /** The photos have changed since the AI looked. */
    stale: boolean;
};

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
    look: VehicleLook | null;
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
    estimate: JobEstimate | null;
    parts?: ServiceRecordPart[];
    vehicle?: {
        id: string;
        display_name: string;
        registration: string | null;
    };
};

/**
 * The AI's estimate of how long a job will take, worked out in the
 * background whenever the job is saved with new notes.
 */
export type JobEstimate = {
    status: 'pending' | 'ready' | 'failed';
    hours: number | null;
    low: number | null;
    high: number | null;
    reasoning: string | null;
    estimated_at: string | null;
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
    parts_status: RepairPartsStatus | null;
    repair_job?: RepairJob | null;
};

export type RepairPartsStatus =
    | 'pending'
    | 'planned'
    | 'none_needed'
    | 'failed';

export type RepairJob = {
    id: string;
    title: string;
    status: ServiceStatus;
    parts: {
        id: string;
        name: string;
        quantity: number;
        unit_abbreviation: string;
        in_inventory: boolean;
        on_hand: number;
    }[];
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

export type ChecklistCheck = { section: string; label: string };

/**
 * The checks added to and left out of one vehicle's copy of a checklist.
 */
export type VehicleChecklistChanges = {
    added: ChecklistCheck[];
    removed: ChecklistCheck[];
};

export type ScheduledCheckStatus =
    | 'done'
    | 'in_progress'
    | 'due'
    | 'overdue'
    | 'upcoming'
    | 'missed';

export type ScheduleEntryKind = 'monthly_check' | 'annual_inspection' | 'job';

export type ScheduleEntry = {
    id: string;
    kind: ScheduleEntryKind;
    title: string;
    date: string;
    due_on: string;
    status: ScheduledCheckStatus;
    vehicle: {
        id: string;
        display_name: string;
        registration: string | null;
    } | null;
    inspection_id: string | null;
    service_record_id: string | null;
    can_move: boolean;
    can_remove: boolean;
    window: { from: string; to: string } | null;
};

export type ClosedDay = {
    date: string;
    reason: string;
    /** Set for a day someone marked closed; null for a statutory holiday. */
    id: string | null;
};

export type ScheduleStats = {
    checks: number;
    checks_done: number;
    annual: number;
    annual_done: number;
    behind: number;
    jobs: number;
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
    unit: string;
    unit_abbreviation: string;
    on_hand: number;
    minimum_quantity?: number;
    required?: number;
    shortfall: number;
    unit_cost: number;
    estimated_cost: number;
    jobs?: { id: string; title: string; vehicle: string | null }[];
    order: {
        id: string;
        quantity_ordered: number;
        quantity_received: number;
    } | null;
};

export type PartOrder = {
    id: string;
    inventory_item_id: string | null;
    in_inventory: boolean;
    name: string;
    part_number: string | null;
    brand: string | null;
    supplier: string | null;
    barcode: string | null;
    unit_abbreviation: string;
    quantity_ordered: number;
    quantity_received: number;
    quantity_outstanding: number;
    ordered_by: string | null;
    ordered_at: string | null;
    received_by: string | null;
    received_at: string | null;
};

export type DecodedBarcode = {
    barcode: string;
    description: string | null;
    brand: string | null;
    source: 'inventory' | 'lookup' | null;
    inventory_item_id: string | null;
    part_order_id: string | null;
};
