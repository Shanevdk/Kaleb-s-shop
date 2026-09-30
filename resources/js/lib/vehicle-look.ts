import type {
    DamageArea,
    LookAccessory,
    LookDamage,
    VehicleLook,
} from '@/types';

/**
 * How what the AI read from a vehicle's photos is written on the page.
 */
export const ACCESSORY_LABELS: Record<LookAccessory, string> = {
    bull_bar: 'Bull bar',
    nudge_bar: 'Nudge bar',
    roof_rack: 'Roof rack',
    roof_rails: 'Roof rails',
    ladder_rack: 'Ladder rack',
    tow_bar: 'Tow bar',
    canopy: 'Canopy',
    tonneau_cover: 'Tonneau cover',
    sports_bar: 'Sports bar',
    snorkel: 'Snorkel',
    side_steps: 'Side steps',
    spotlights: 'Spotlights',
    light_bar: 'Light bar',
    mud_flaps: 'Mud flaps',
    sunroof: 'Sunroof',
    rooftop_tent: 'Rooftop tent',
};

export const AREA_LABELS: Record<DamageArea, string> = {
    front_bumper: 'Front bumper',
    rear_bumper: 'Rear bumper',
    bonnet: 'Bonnet',
    roof: 'Roof',
    windscreen: 'Windscreen',
    rear_window: 'Rear window',
    grille: 'Grille',
    left_headlight: 'Left headlight',
    right_headlight: 'Right headlight',
    left_taillight: 'Left tail light',
    right_taillight: 'Right tail light',
    left_mirror: 'Left mirror',
    right_mirror: 'Right mirror',
    front_left_door: 'Front left door',
    front_right_door: 'Front right door',
    rear_left_door: 'Rear left door',
    rear_right_door: 'Rear right door',
    left_front_guard: 'Left front guard',
    right_front_guard: 'Right front guard',
    left_rear_quarter: 'Left rear quarter',
    right_rear_quarter: 'Right rear quarter',
    left_sill: 'Left sill',
    right_sill: 'Right sill',
    left_front_wheel: 'Left front wheel',
    right_front_wheel: 'Right front wheel',
    left_rear_wheel: 'Left rear wheel',
    right_rear_wheel: 'Right rear wheel',
    tailgate: 'Tailgate',
    tray: 'Tray',
    other: 'Elsewhere',
};

export const DAMAGE_LABELS: Record<LookDamage['kind'], string> = {
    dent: 'Dent',
    scratch: 'Scratch',
    scrape: 'Scrape',
    rust: 'Rust',
    crack: 'Crack',
    missing: 'Missing',
    flat_tyre: 'Flat tyre',
    other: 'Damage',
};

export const BODY_LABELS: Record<
    NonNullable<VehicleLook['body_style']>,
    string
> = {
    sedan: 'Sedan',
    hatchback: 'Hatchback',
    wagon: 'Wagon',
    coupe: 'Coupe',
    convertible: 'Convertible',
    suv: 'SUV',
    ute: 'Ute',
    van: 'Van',
    truck: 'Truck',
    bus: 'Bus',
    motorcycle: 'Motorcycle',
    other: 'Other',
};

/**
 * The colour a damage pin and its row are marked in, by how bad it is.
 */
export const SEVERITY_CLASSES: Record<LookDamage['severity'], string> = {
    minor: 'bg-amber-400 text-amber-950',
    moderate: 'bg-orange-500 text-white',
    severe: 'bg-red-600 text-white',
};

/**
 * The wheels in a few words: "Black 6-spoke alloys", "Steel with hubcaps".
 */
export function describeWheels(wheels: VehicleLook['wheels']): string | null {
    if (!wheels) {
        return null;
    }

    const colour = wheels.colour
        ? wheels.colour.charAt(0).toUpperCase() + wheels.colour.slice(1)
        : null;

    if (wheels.style === 'hubcap') {
        return 'Steel with hubcaps';
    }

    if (wheels.style === 'steel') {
        return `${colour ?? 'Plain'} steel wheels`;
    }

    return [colour, wheels.spokes ? `${wheels.spokes}-spoke` : null, 'alloys']
        .filter(Boolean)
        .join(' ');
}

/**
 * How sure the AI said it was, in words.
 */
export function describeConfidence(confidence: number | null): string | null {
    if (confidence === null) {
        return null;
    }

    return confidence >= 0.75
        ? 'Fairly sure'
        : confidence >= 0.45
          ? 'Somewhat sure'
          : 'Not very sure';
}
