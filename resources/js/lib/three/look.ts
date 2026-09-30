import * as THREE from 'three';
import type { Line, ResolvedLines } from '@/lib/three/body-shell';
import { lerp, smoothCurve } from '@/lib/three/curves';
import type { Materials } from '@/lib/three/materials';
import { paintFinish, type PaintFinish } from '@/lib/three/paint';
import type { RoadSpec } from '@/lib/three/road';
import {
    bentTube,
    box,
    cyl,
    instanced,
    lathe,
    puck,
    rod,
    torus,
    tube,
    type Point3,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import { raycastSurface, type Surface } from '@/lib/three/surface';
import { tyreRadius, type RimStyle, type WheelSpec } from '@/lib/three/wheels';
import type {
    DamageArea,
    LookAccessory,
    MachineKind,
    VehicleLook,
} from '@/types';

/**
 * A place on the machine a damage pin can stand, and the way the surface
 * faces there, so the pin can hide when it is round the back.
 */
export type Anchor = { position: THREE.Vector3; normal: THREE.Vector3 };

export type Anchors = Map<DamageArea, Anchor>;

/**
 * What a road vehicle's builder knows about its body once the shell is
 * made, for bolting things on to it.
 */
export type BodyContext = {
    spec: RoadSpec;
    lines: ResolvedLines;
    surface: Surface;
};

/** Accessories that belong on a ute's tub rather than on its cab. */
export const TUB_ACCESSORIES: LookAccessory[] = [
    'canopy',
    'tonneau_cover',
    'sports_bar',
    'tow_bar',
    'ladder_rack',
];

const KINDS: Partial<
    Record<NonNullable<VehicleLook['body_style']>, MachineKind>
> = {
    sedan: 'car',
    hatchback: 'car',
    wagon: 'car',
    coupe: 'car',
    convertible: 'car',
    suv: 'suv',
    ute: 'ute',
    van: 'van',
    truck: 'truck',
    bus: 'bus',
    motorcycle: 'motorcycle',
};

const CAR_BODIES = ['sedan', 'hatchback', 'wagon', 'coupe', 'convertible'];

/**
 * The kind of machine to build: a vehicle the shop could not place gets
 * the body the photos show.
 */
export function lookKind(
    kind: MachineKind,
    look: VehicleLook | null | undefined,
): MachineKind {
    return kind === 'other' && look?.body_style
        ? (KINDS[look.body_style] ?? kind)
        : kind;
}

/**
 * A car's body style, from its records or failing that from the photos.
 */
export function lookBodyClass(
    bodyClass: string | null | undefined,
    look: VehicleLook | null | undefined,
): string | null {
    if (bodyClass) {
        return bodyClass;
    }

    return look?.body_style && CAR_BODIES.includes(look.body_style)
        ? look.body_style
        : null;
}

/**
 * The paint the photos show: the named shade from the paint palette,
 * pulled halfway to the colour the AI measured (all of the way when the
 * palette does not know the name), in the finish it saw. Null when it saw
 * no colour.
 */
export function lookFinish(
    look: VehicleLook | null | undefined,
): PaintFinish | null {
    const colour = look?.colour;

    if (!colour) {
        return null;
    }

    const named = paintFinish(colour.name);
    const known = named.hex !== paintFinish(null).hex;
    const hex = colour.hex
        ? `#${new THREE.Color(named.hex)
              .lerp(new THREE.Color(colour.hex), known ? 0.5 : 1)
              .getHexString()}`
        : named.hex;
    const metallic =
        colour.finish === 'metallic'
            ? Math.max(0.6, named.metallic)
            : colour.finish === 'pearl'
              ? Math.max(0.3, named.metallic * 0.6)
              : colour.finish === 'matte'
                ? named.metallic * 0.5
                : named.metallic * 0.3;

    return {
        hex,
        metallic,
        pearl: colour.finish === 'pearl',
        matte: colour.finish === 'matte',
        name: colour.name,
    };
}

/**
 * The rims' paint for the colour the AI saw, or nothing to keep their
 * usual finish.
 */
function rimFinish(
    m: Materials,
    colour: NonNullable<VehicleLook['wheels']>['colour'],
): THREE.Material | undefined {
    const coat = (color: number, metalness: number, roughness: number) =>
        new THREE.MeshPhysicalMaterial({
            color,
            metalness,
            roughness,
            clearcoat: 0.7,
            clearcoatRoughness: 0.1,
        });

    switch (colour) {
        case 'black':
            return coat(0x101113, 0.3, 0.32);
        case 'gunmetal':
            return coat(0x3c4045, 0.75, 0.3);
        case 'bronze':
            return coat(0x6f5332, 0.8, 0.3);
        case 'white':
            return coat(0xebebe7, 0.05, 0.3);
        case 'chrome':
            return m.chrome;
        default:
            return undefined;
    }
}

/**
 * Change a road vehicle's spec to what the photos show: the wheels, the
 * tint on the glass and rails on the roof.
 */
export function applyLook(
    spec: RoadSpec,
    look: VehicleLook | null | undefined,
    m: Materials,
): RoadSpec {
    if (!look) {
        return spec;
    }

    let result = spec;
    const wheels = look.wheels;

    if (wheels && !['truck', 'moto', 'atv'].includes(spec.wheels.rim)) {
        const rim: RimStyle =
            wheels.style === 'steel'
                ? 'steel'
                : wheels.style === 'hubcap'
                  ? 'hubcap'
                  : wheels.spokes === 6
                    ? 'spoke6'
                    : wheels.spokes !== null && wheels.spokes >= 7
                      ? 'mesh10'
                      : 'split5';
        const finished: WheelSpec = {
            ...spec.wheels,
            rim,
            rimMaterial: rimFinish(m, wheels.colour),
        };
        result = { ...result, wheels: finished };
    }

    if (look.tinted_windows === true) {
        const behind = spec.doorLines[1]?.[1] ?? spec.axles[1];
        result = {
            ...result,
            glass: {
                ...result.glass,
                privacyFrom: Math.min(
                    result.glass.privacyFrom ?? Infinity,
                    behind,
                ),
            },
        };
    } else if (look.tinted_windows === false) {
        result = {
            ...result,
            glass: { ...result.glass, privacyFrom: undefined },
        };
    }

    if (look.accessories.includes('roof_rails') && !spec.roofRails) {
        const design = spec.design;
        result = {
            ...result,
            roofRails: [design.header - 0.12, design.rearHeader + 0.1, 0.62],
        };
    }

    return result;
}

/**
 * A high-roof van: the roof stepped up just behind the cab's side glass,
 * the way the high-roof versions of vans are, with the sides carried
 * straight up to it.
 */
export function highRoof(spec: RoadSpec): RoadSpec {
    const design = spec.design;
    const lift = 0.3;
    const step = Math.min(design.header - 0.35, spec.glass.rear[1] - 0.12);
    const raise = (line: Line): Line => {
        const original = smoothCurve(line);

        return [
            ...line.filter(([x]) => x > step + 0.12),
            [step + 0.12, original(step + 0.12)],
            [step - 0.12, original(step - 0.12) + lift],
            ...line
                .filter(([x]) => x < step - 0.12)
                .map(([x, y]): [number, number] => [x, y + lift]),
        ];
    };

    return {
        ...spec,
        design: {
            ...design,
            roof: raise(design.roof),
            glassTop: raise(design.glassTop),
        },
    };
}

/**
 * Black powder coat, for bars and racks.
 */
export function powderCoat(): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
        color: 0x141517,
        metalness: 0.2,
        roughness: 0.45,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
    });
}

/**
 * Bolt on what the photos show on a road vehicle's body: bars and lights
 * on the front, racks and tents on the roof, a snorkel up the pillar,
 * steps along the sills, flaps behind the wheels and a tow bar at the
 * back.
 */
export function buildAccessories(
    m: Materials,
    context: BodyContext,
    accessories: LookAccessory[],
    body: THREE.Group,
): void {
    if (accessories.length === 0) {
        return;
    }

    const has = (accessory: LookAccessory) => accessories.includes(accessory);
    const group = new THREE.Group();
    const coat = powderCoat();
    const front = has('bull_bar')
        ? bullBar(m, context, coat, group, false)
        : has('nudge_bar')
          ? bullBar(m, context, coat, group, true)
          : null;

    if (has('spotlights')) {
        spotlights(m, context, front, group);
    }

    const rack =
        has('roof_rack') || has('rooftop_tent') || has('ladder_rack')
            ? roofRack(
                  context,
                  coat,
                  group,
                  !has('roof_rack') && has('ladder_rack'),
              )
            : null;

    if (has('light_bar')) {
        lightBar(
            m,
            context,
            front && !has('spotlights') ? front : null,
            rack,
            group,
        );
    }

    if (rack && has('ladder_rack')) {
        ladder(m, rack, group);
    }

    if (rack && has('rooftop_tent')) {
        tent(m, rack, group);
    }

    if (has('snorkel')) {
        snorkel(m, context, group);
    }

    if (has('side_steps')) {
        sideSteps(m, context, group);
    }

    if (has('mud_flaps')) {
        mudFlaps(m, context, group);
    }

    if (has('tow_bar')) {
        towBar(
            m,
            context.spec.design.rear,
            context.lines.rocker(context.spec.design.rear + 0.25) + 0.08,
            group,
        );
    }

    group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    body.add(group);
}

/**
 * Where the front of the body is at a height and a distance across, found
 * by looking back at it from ahead.
 */
function frontAt(context: BodyContext, y: number, z: number): number {
    const design = context.spec.design;
    const hit = raycastSurface(
        context.surface,
        new THREE.Vector3(design.front + 2, y, z),
        new THREE.Vector3(-1, 0, 0),
    );

    return hit ? hit.position.x : design.front;
}

/**
 * How high the roof is at a point, or null off the edge of it.
 */
function roofAt(context: BodyContext, x: number, z: number): number | null {
    const hit = raycastSurface(
        context.surface,
        new THREE.Vector3(x, 6, z),
        new THREE.Vector3(0, -1, 0),
    );

    return hit ? hit.position.y : null;
}

/**
 * How far out the side of the body is at a point along it and a height.
 */
function sideAt(
    context: BodyContext,
    x: number,
    y: number,
    side: 1 | -1,
): number {
    const hit = raycastSurface(
        context.surface,
        new THREE.Vector3(x, y, side * 3),
        new THREE.Vector3(0, 0, -side),
    );

    return hit ? hit.position.z : side * context.lines.width(x);
}

type FrontBar = { top: number; x: (z: number) => number };

/**
 * A steel bull bar that follows the nose: a top rail at headlamp height
 * wrapping round the corners, two uprights either side of the grille,
 * wings round the lamps, a lower rail and a bash plate under it. A nudge
 * bar is just the middle loop.
 */
function bullBar(
    m: Materials,
    context: BodyContext,
    coat: THREE.Material,
    group: THREE.Group,
    nudge: boolean,
): FrontBar {
    const { spec, lines } = context;
    const design = spec.design;
    const half = lines.width(design.front - 0.25);
    const lower = lines.rocker(design.front) + 0.1;
    const top = Math.max(...spec.headlamp.map(([, y]) => y)) + 0.02;
    const clear = 0.07;
    const reach = half * 0.86;
    const rail = (z: number, y: number, extra = 0): Point3 => [
        frontAt(context, y, z) + clear + extra,
        y,
        z,
    ];
    const radius = 0.028;

    if (nudge) {
        const span = 0.36;
        group.add(
            tube(
                [
                    rail(-span, lower + 0.12, 0.02),
                    rail(-span, top - 0.1),
                    rail(-span * 0.6, top - 0.02),
                    rail(0, top),
                    rail(span * 0.6, top - 0.02),
                    rail(span, top - 0.1),
                    rail(span, lower + 0.12, 0.02),
                ],
                radius,
                coat,
                { segments: 80 },
            ),
        );

        return { top, x: (z) => frontAt(context, top, z) + clear };
    }

    const railPoints: Point3[] = [];

    for (let i = 0; i <= 12; i++) {
        const z = -reach + (i / 12) * reach * 2;
        const droop = Math.pow(Math.abs(z) / reach, 4) * 0.07;
        railPoints.push(rail(z, top - droop));
    }

    group.add(tube(railPoints, radius, coat, { segments: 120 }));

    for (const z of [-0.3, 0.3]) {
        group.add(
            tube(
                [
                    rail(z, lower, 0.04),
                    rail(z, (lower + top) / 2, 0.02),
                    rail(z, top),
                ],
                radius,
                coat,
            ),
        );
    }

    for (const side of [1, -1]) {
        group.add(
            tube(
                [
                    rail(side * reach, top - 0.07),
                    rail(side * (reach + 0.02), (lower + top) / 2),
                    rail(side * reach * 0.94, lower + 0.08, 0.02),
                ],
                radius * 0.9,
                coat,
            ),
        );
    }

    const lowerRail: Point3[] = [];

    for (let i = 0; i <= 8; i++) {
        const z = -reach * 0.94 + (i / 8) * reach * 1.88;
        lowerRail.push(rail(z, lower + 0.08, 0.03));
    }

    group.add(tube(lowerRail, radius * 0.85, coat));

    // The bash plate under the bumper, tipped up at the front.
    const plateX = frontAt(context, lower, 0) - 0.08;
    const plate = box(
        0.36,
        0.012,
        reach * 1.3,
        coat,
        plateX,
        lower - 0.07,
        0,
        0.004,
    );
    plate.rotation.z = 0.28;
    group.add(plate);

    // The bar's mounts back under the body.
    for (const z of [-0.3, 0.3]) {
        group.add(
            box(
                0.3,
                0.07,
                0.06,
                coat,
                frontAt(context, lower, z) - 0.1,
                lower + 0.02,
                z,
                0.01,
            ),
        );
    }

    group.add(
        instanced(
            new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12),
            m.chrome,
            [-0.3, 0.3].map((z) => {
                const [x, y] = rail(z, top);

                return { x, y: y + radius, z };
            }),
        ),
    );

    return { top: top + radius, x: (z) => frontAt(context, top, z) + clear };
}

/**
 * A pair of round driving lights: on the bar when there is one, otherwise
 * on the bumper.
 */
function spotlights(
    m: Materials,
    context: BodyContext,
    bar: FrontBar | null,
    group: THREE.Group,
): void {
    const design = context.spec.design;
    const baseY = bar ? bar.top : context.lines.rocker(design.front) + 0.3;

    for (const z of [-0.42, 0.42]) {
        const x = bar ? bar.x(z) : frontAt(context, baseY, z) + 0.06;
        const lamp = new THREE.Group();
        lamp.position.set(x, baseY + 0.11, z);
        lamp.add(puck(0.1, 0.09, m.gloss, 'x', -0.02, 0, 0, { segments: 40 }));
        lamp.add(
            lathe(
                [
                    [0.02, -0.035],
                    [0.07, -0.015],
                    [0.088, 0.012],
                ],
                m.reflector,
                'x',
                0.012,
                0,
                0,
                40,
            ),
        );
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 40), m.lens);
        lens.rotation.y = Math.PI / 2;
        lens.position.x = 0.026;
        lamp.add(lens);
        lamp.add(
            torus(0.091, 0.006, m.chrome, 'x', 0.026, 0, 0, {
                radial: 8,
                tubular: 48,
            }),
        );
        lamp.add(box(0.03, 0.08, 0.03, m.gloss, -0.02, -0.08, 0, 0.006));
        group.add(lamp);
    }
}

export type Rack = { from: number; to: number; y: number; half: number };

/**
 * A flat platform rack across the roof on feet at the gutters, or for a
 * ladder rack three bars with rollers.
 */
function roofRack(
    context: BodyContext,
    coat: THREE.Material,
    group: THREE.Group,
    barsOnly: boolean,
): Rack | null {
    const design = context.spec.design;
    let from = design.header - 0.1;
    const to =
        design.rearHeader - design.rear > 0.2
            ? design.rearHeader + 0.1
            : design.rear + 0.3;
    const half = Math.min(
        context.lines.glassWidth((from + to) / 2) - 0.03,
        0.72,
    );
    let highest = -Infinity;

    for (let x = from; x >= to; x -= 0.1) {
        for (const z of [-half, 0, half]) {
            highest = Math.max(highest, roofAt(context, x, z) ?? -Infinity);
        }
    }

    // A raised roof starts behind the cab, and so does its rack.
    while (
        from - to > 0.5 &&
        (roofAt(context, from, 0) ?? highest) < highest - 0.1
    ) {
        from -= 0.05;
    }

    if (!Number.isFinite(highest) || from - to < 0.5) {
        return null;
    }

    const mid = (from + to) / 2;
    const y = highest + 0.08;
    const feet = barsOnly
        ? [from - 0.1, mid, to + 0.1]
        : [from - 0.08, mid, to + 0.08];

    for (const x of feet) {
        for (const side of [1, -1]) {
            const base = roofAt(context, x, side * half * 0.94) ?? y - 0.08;
            group.add(
                box(
                    0.06,
                    y - base + 0.01,
                    0.05,
                    coat,
                    x,
                    (y + base) / 2,
                    side * half * 0.94,
                    0.008,
                ),
            );
        }
    }

    if (barsOnly) {
        const nylon = new THREE.MeshStandardMaterial({
            color: 0x1c1d1f,
            roughness: 0.5,
        });

        for (const x of feet) {
            group.add(
                rod([x, y, -half - 0.05], [x, y, half + 0.05], 0.018, coat),
            );

            for (const side of [1, -1]) {
                group.add(
                    cyl(
                        0.022,
                        0.1,
                        nylon,
                        'x',
                        x,
                        y + 0.03,
                        side * (half + 0.02),
                    ),
                );
                group.add(
                    rod(
                        [x, y, side * (half + 0.05)],
                        [x, y + 0.1, side * (half + 0.05)],
                        0.012,
                        coat,
                    ),
                );
            }
        }

        return { from, to, y, half };
    }

    group.add(
        bentTube(
            [
                [from, y, half],
                [to, y, half],
                [to, y, -half],
                [from, y, -half],
            ],
            0.016,
            coat,
            0.1,
            { closed: true },
        ),
    );

    const slats = Math.max(3, Math.floor((from - to - 0.1) / 0.16));
    group.add(
        instanced(
            new THREE.BoxGeometry(0.045, 0.014, half * 2 - 0.03),
            coat,
            Array.from({ length: slats }, (_, i) => ({
                x: to + 0.05 + ((from - to - 0.1) * (i + 0.5)) / slats,
                y,
                z: 0,
            })),
        ),
    );
    const deflector = box(
        0.018,
        0.07,
        half * 2 - 0.12,
        coat,
        from + 0.03,
        y + 0.02,
        0,
        0.004,
    );
    deflector.rotation.z = -0.7;
    group.add(deflector);

    return { from, to, y, half };
}

/**
 * A yellow fibreglass ladder strapped to the rack.
 */
export function ladder(m: Materials, rack: Rack, group: THREE.Group): void {
    const length = Math.min(rack.from - rack.to + 0.3, 3.2);
    const centre = (rack.from + rack.to) / 2;
    const y = rack.y + 0.06;

    for (const z of [-0.2, 0.2]) {
        group.add(
            box(length, 0.075, 0.028, m.yellow, centre, y + 0.02, z, 0.006),
        );
    }

    const rungs = Math.floor(length / 0.3);
    group.add(
        instanced(
            new THREE.CylinderGeometry(0.014, 0.014, 0.4, 12),
            m.alloy,
            Array.from({ length: rungs }, (_, i) => ({
                x: centre - length / 2 + ((i + 0.5) * length) / rungs,
                y: y + 0.02,
                z: 0,
                rx: Math.PI / 2,
            })),
        ),
    );

    for (const x of [rack.from - 0.2, rack.to + 0.2]) {
        group.add(box(0.03, 0.012, 0.5, m.plastic, x, y + 0.062, 0, 0.004));
    }
}

/**
 * A hard-shell rooftop tent folded down on the rack.
 */
function tent(m: Materials, rack: Rack, group: THREE.Group): void {
    const length = Math.min(rack.from - rack.to + 0.1, 2.15);
    const centre = (rack.from + rack.to) / 2;
    const shell = new THREE.MeshPhysicalMaterial({
        color: 0x2f3237,
        metalness: 0.1,
        roughness: 0.5,
        clearcoat: 0.4,
    });
    group.add(
        softBox(length, 0.1, 1.3, m.plastic, centre, rack.y + 0.07, 0, {
            crease: 0.8,
            divisions: [3, 1, 2],
        }),
    );
    group.add(
        softBox(length - 0.04, 0.16, 1.26, shell, centre, rack.y + 0.2, 0, {
            crease: 0.5,
            divisions: [3, 1, 2],
            shape: (p) => {
                p.y += Math.cos((p.z / 0.63) * (Math.PI / 2)) * 0.02;
            },
        }),
    );

    for (const x of [centre - length * 0.3, centre + length * 0.3]) {
        group.add(
            box(0.05, 0.012, 1.32, m.plastic, x, rack.y + 0.12, 0, 0.004),
        );
    }
}

/**
 * A long LED light bar: on the bull bar when there is room, otherwise on
 * the rack or along the front of the roof.
 */
function lightBar(
    m: Materials,
    context: BodyContext,
    bar: FrontBar | null,
    rack: Rack | null,
    group: THREE.Group,
): void {
    const design = context.spec.design;
    const width = bar ? 0.8 : 1.05;
    let x: number;
    let y: number;

    if (bar) {
        x = bar.x(0) - 0.01;
        y = bar.top + 0.07;
    } else if (rack) {
        x = rack.from + 0.02;
        y = rack.y + 0.07;
    } else {
        x = design.header + 0.02;
        y =
            (roofAt(context, design.header - 0.05, 0) ??
                context.lines.roof(design.header)) + 0.08;
    }

    const light = new THREE.Group();
    light.position.set(x, y, 0);
    light.add(box(0.07, 0.085, width, m.gloss, 0, 0, 0, 0.012));
    light.add(box(0.006, 0.06, width - 0.04, m.reflector, 0.034, 0, 0, 0.002));
    light.add(box(0.004, 0.066, width - 0.03, m.lens, 0.038, 0, 0, 0.002));

    for (const side of [1, -1]) {
        light.add(
            box(
                0.05,
                0.08,
                0.012,
                m.gloss,
                -0.01,
                -0.06,
                side * (width / 2 - 0.05),
                0.004,
            ),
        );
    }

    group.add(light);
}

/**
 * A raised air intake up the passenger-side pillar, from the wing to a
 * ram head at the roofline.
 */
function snorkel(m: Materials, context: BodyContext, group: THREE.Group): void {
    const { spec, lines } = context;
    const design = spec.design;
    const side = -1;
    const start = spec.axles[0] - spec.archRadius * 0.15;
    const points: [number, number][] = [
        [start, lines.shoulder(start) - 0.06],
        [
            (start + design.cowl) / 2,
            lines.shoulder((start + design.cowl) / 2) + 0.02,
        ],
        [design.cowl + 0.04, lines.belt(design.cowl) + 0.06],
    ];
    const roofline = lines.roof(design.header);
    const pillarBase = lines.belt(design.cowl) + 0.06;

    for (const t of [0.35, 0.7, 0.92]) {
        points.push([
            lerp(design.cowl, design.header, t),
            lerp(pillarBase, roofline, t),
        ]);
    }

    const path: Point3[] = points.map(([x, y]) => [
        x,
        y,
        sideAt(context, x, y, side) + side * 0.06,
    ]);
    group.add(tube(path, 0.042, m.plastic, { segments: 90, radial: 16 }));

    const [tx, ty, tz] = path[path.length - 1];
    group.add(
        softBox(0.22, 0.14, 0.13, m.plastic, tx + 0.07, ty + 0.05, tz, {
            crease: 0.6,
        }),
    );
    group.add(box(0.012, 0.09, 0.1, m.gloss, tx + 0.18, ty + 0.05, tz, 0.004));

    for (const [x, y, z] of [path[1], path[3]]) {
        group.add(
            box(0.05, 0.03, 0.05, m.plastic, x, y, z - side * 0.035, 0.006),
        );
    }
}

/**
 * Running boards along the sills between the arches, with rubber tread
 * strips and their brackets.
 */
function sideSteps(
    m: Materials,
    context: BodyContext,
    group: THREE.Group,
): void {
    const { spec, lines } = context;
    const from = spec.axles[0] - spec.archRadius - 0.07;
    const to = spec.axles[1] + spec.archRadius + 0.07;
    const mid = (from + to) / 2;
    const length = from - to;
    const y = lines.rocker(mid) - 0.03;

    for (const side of [1, -1]) {
        const inner =
            Math.abs(
                sideAt(context, mid, lines.rocker(mid) + 0.08, side as 1 | -1),
            ) - 0.04;
        const z = side * (inner + 0.08);
        group.add(box(length, 0.03, 0.16, m.gloss, mid, y, z, 0.01));
        group.add(
            instanced(
                new THREE.BoxGeometry(0.02, 0.006, 0.12),
                m.rubber,
                Array.from({ length: Math.floor(length / 0.06) }, (_, i) => ({
                    x: to + 0.04 + i * 0.06,
                    y: y + 0.017,
                    z,
                })),
            ),
        );

        for (const x of [from - 0.2, mid, to + 0.2]) {
            group.add(
                box(
                    0.04,
                    0.06,
                    0.1,
                    m.underbody,
                    x,
                    y + 0.035,
                    side * inner,
                    0.006,
                ),
            );
        }
    }
}

/**
 * Rubber flaps hanging behind each wheel.
 */
function mudFlaps(
    m: Materials,
    context: BodyContext,
    group: THREE.Group,
): void {
    const { spec, lines } = context;
    const tyre = spec.wheels.tyre;

    for (const axle of spec.axles) {
        const x = axle - spec.archRadius - 0.015;
        const topY = lines.rocker(x) + 0.08;
        const height = topY - 0.1;

        for (const side of [1, -1]) {
            group.add(
                box(
                    0.006,
                    height,
                    tyre.width * 1.1,
                    m.rubber,
                    x,
                    0.1 + height / 2,
                    side * (spec.track + 0.01),
                    0.002,
                ),
            );
        }
    }
}

/**
 * A tow bar under the back: the receiver tongue, the ball mount with its
 * fifty-millimetre ball, the pin and the chain loops.
 */
export function towBar(
    m: Materials,
    rear: number,
    y: number,
    group: THREE.Group,
): void {
    const tow = new THREE.Group();
    tow.position.set(rear, y, 0);
    tow.add(box(0.36, 0.065, 0.065, m.gloss, 0.02, 0, 0, 0.006));
    tow.add(box(0.2, 0.05, 0.055, m.steel, -0.2, 0.01, 0, 0.006));
    tow.add(box(0.05, 0.1, 0.055, m.steel, -0.3, 0.05, 0, 0.006));
    tow.add(cyl(0.013, 0.05, m.chrome, 'y', -0.3, 0.12, 0));
    tow.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 24, 16), m.chrome));
    tow.children[tow.children.length - 1].position.set(-0.3, 0.16, 0);
    tow.add(cyl(0.008, 0.11, m.chrome, 'z', -0.1, 0, 0));

    for (const z of [-0.05, 0.05]) {
        tow.add(
            torus(0.022, 0.006, m.steel, 'x', -0.08, -0.05, z, {
                radial: 6,
                tubular: 18,
            }),
        );
    }

    group.add(tow);
}

/**
 * Where on a road vehicle's body each area the AI can name is, found by
 * looking at the body from outside.
 */
export function roadAnchors(context: BodyContext): Anchors {
    const { spec, lines, surface } = context;
    const design = spec.design;
    const anchors: Anchors = new Map();
    const hit = (
        origin: THREE.Vector3,
        direction: THREE.Vector3,
    ): Anchor | null => {
        const found = raycastSurface(surface, origin, direction);

        return found
            ? {
                  position: found.position.clone(),
                  normal: found.normal.clone().normalize(),
              }
            : null;
    };
    const fromSide = (x: number, y: number, side: 1 | -1) =>
        hit(new THREE.Vector3(x, y, side * 3), new THREE.Vector3(0, 0, -side));
    const fromAbove = (x: number, z: number) =>
        hit(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
    const fromEnd = (end: 1 | -1, y: number, z: number) =>
        hit(new THREE.Vector3(end * 12, y, z), new THREE.Vector3(-end, 0, 0));
    const put = (area: DamageArea, anchor: Anchor | null) => {
        if (anchor) {
            anchors.set(area, anchor);
        }
    };
    const outline = (points: [number, number][]) => ({
        z: points.reduce((sum, [z]) => sum + z, 0) / Math.max(1, points.length),
        y:
            points.reduce((sum, [, y]) => sum + y, 0) /
            Math.max(1, points.length),
    });
    const sides: [1 | -1, 'left' | 'right'][] = [
        [-1, 'left'],
        [1, 'right'],
    ];

    put('front_bumper', fromEnd(1, lines.rocker(design.front) + 0.14, 0.25));
    put('rear_bumper', fromEnd(-1, lines.rocker(design.rear) + 0.14, 0.25));
    put('bonnet', fromAbove(lerp(design.cowl, design.front, 0.45), 0));
    put('windscreen', fromAbove(lerp(design.cowl, design.header, 0.5), 0.1));
    put('roof', fromAbove(lerp(design.header, design.rearHeader, 0.45), 0));
    put(
        'rear_window',
        design.rearHeader - design.deck > 0.05
            ? fromAbove(lerp(design.rearHeader, design.deck, 0.5), 0)
            : spec.tailgateGlass
              ? fromEnd(-1, outline(spec.tailgateGlass).y, 0.15)
              : null,
    );
    put(
        'tailgate',
        fromEnd(
            -1,
            lerp(lines.rocker(design.rear), lines.shoulder(design.rear), 0.75),
            -0.15,
        ),
    );

    const grille = outline(spec.grille);
    const grilleX = frontAt(context, grille.y + 0.1, 0);
    anchors.set('grille', {
        position: new THREE.Vector3(grilleX, grille.y, 0.12),
        normal: new THREE.Vector3(1, 0, 0),
    });

    const lamp = outline(spec.headlamp);
    const tail =
        spec.taillamp.length >= 3
            ? outline(spec.taillamp)
            : { z: 0.7, y: lines.shoulder(design.rear) - 0.05 };
    const wheelY = tyreRadius(spec.wheels.tyre);
    const doorMid = (a: [number, number], b: [number, number]) =>
        (a[0] + a[1] + b[0] + b[1]) / 4;

    for (const [side, name] of sides) {
        put(`${name}_headlight`, fromEnd(1, lamp.y, side * lamp.z));
        put(`${name}_taillight`, fromEnd(-1, tail.y, side * tail.z));

        const mirror = fromSide(
            spec.mirror,
            lines.belt(spec.mirror) + 0.08,
            side,
        );

        if (mirror) {
            mirror.position.z += side * 0.22 * (spec.mirrorScale ?? 1);
            mirror.position.y += 0.02;
            put(`${name}_mirror`, mirror);
        }

        const [first, second, third] = spec.doorLines;

        if (first && second) {
            const x = doorMid(first, second);
            put(
                `front_${name}_door`,
                fromSide(x, lerp(lines.rocker(x), lines.belt(x), 0.55), side),
            );
        }

        if (second && third) {
            const x = doorMid(second, third);
            put(
                `rear_${name}_door`,
                fromSide(x, lerp(lines.rocker(x), lines.belt(x), 0.55), side),
            );
        }

        const [frontAxle, rearAxle] = spec.axles;
        put(
            `${name}_front_guard`,
            fromSide(frontAxle, lines.shoulder(frontAxle) - 0.08, side),
        );
        put(
            `${name}_rear_quarter`,
            fromSide(rearAxle, lines.shoulder(rearAxle) - 0.08, side),
        );
        put(
            `${name}_sill`,
            fromSide(
                (frontAxle + rearAxle) / 2,
                lines.rocker((frontAxle + rearAxle) / 2) + 0.06,
                side,
            ),
        );

        for (const [axle, where] of [
            [frontAxle, 'front'],
            [rearAxle, 'rear'],
        ] as const) {
            anchors.set(`${name}_${where}_wheel`, {
                position: new THREE.Vector3(
                    axle,
                    wheelY,
                    side * (spec.track + spec.wheels.tyre.width / 2 + 0.03),
                ),
                normal: new THREE.Vector3(0, 0, side),
            });
        }
    }

    const top = fromAbove(lerp(design.header, design.rearHeader, 0.5), 0);

    if (top) {
        anchors.set('other', {
            position: top.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
            normal: new THREE.Vector3(0, 1, 0),
        });
    }

    return anchors;
}

// [along from the back 0..1, height 0..1, across -1..1, facing]
const BOUNDS_TABLE: Record<
    DamageArea,
    [number, number, number, 'x' | '-x' | 'y' | 'z' | '-z']
> = {
    front_bumper: [1, 0.3, 0, 'x'],
    grille: [1, 0.45, 0, 'x'],
    rear_bumper: [0, 0.3, 0, '-x'],
    tailgate: [0, 0.5, 0, '-x'],
    bonnet: [0.85, 1, 0, 'y'],
    windscreen: [0.7, 1, 0, 'y'],
    roof: [0.5, 1, 0, 'y'],
    rear_window: [0.25, 1, 0, 'y'],
    tray: [0.2, 1, 0, 'y'],
    other: [0.5, 1, 0, 'y'],
    left_headlight: [1, 0.55, -0.6, 'x'],
    right_headlight: [1, 0.55, 0.6, 'x'],
    left_taillight: [0, 0.55, -0.6, '-x'],
    right_taillight: [0, 0.55, 0.6, '-x'],
    front_left_door: [0.58, 0.45, -1, '-z'],
    front_right_door: [0.58, 0.45, 1, 'z'],
    rear_left_door: [0.4, 0.45, -1, '-z'],
    rear_right_door: [0.4, 0.45, 1, 'z'],
    left_front_guard: [0.8, 0.5, -1, '-z'],
    right_front_guard: [0.8, 0.5, 1, 'z'],
    left_rear_quarter: [0.18, 0.5, -1, '-z'],
    right_rear_quarter: [0.18, 0.5, 1, 'z'],
    left_sill: [0.5, 0.15, -1, '-z'],
    right_sill: [0.5, 0.15, 1, 'z'],
    left_mirror: [0.65, 0.7, -1, '-z'],
    right_mirror: [0.65, 0.7, 1, 'z'],
    left_front_wheel: [0.8, 0.2, -1, '-z'],
    right_front_wheel: [0.8, 0.2, 1, 'z'],
    left_rear_wheel: [0.2, 0.2, -1, '-z'],
    right_rear_wheel: [0.2, 0.2, 1, 'z'],
};

/**
 * An anchor for a machine with no lines plan to go on: a point on its
 * bounding box, dropped onto whatever is really there.
 */
export function boundsAnchor(
    body: THREE.Object3D,
    bounds: THREE.Box3,
    area: DamageArea,
): Anchor {
    const [along, height, across, facing] = BOUNDS_TABLE[area];
    const size = bounds.getSize(new THREE.Vector3());
    const point = new THREE.Vector3(
        bounds.min.x + size.x * along,
        bounds.min.y + size.y * height,
        (bounds.min.z + bounds.max.z) / 2 + (size.z / 2) * across,
    );
    const normal = new THREE.Vector3(
        facing === 'x' ? 1 : facing === '-x' ? -1 : 0,
        facing === 'y' ? 1 : 0,
        facing === 'z' ? 1 : facing === '-z' ? -1 : 0,
    );
    const raycaster = new THREE.Raycaster(
        point.clone().addScaledVector(normal, Math.max(size.x, size.y, size.z)),
        normal.clone().negate(),
    );
    const found = raycaster
        .intersectObject(body, true)
        .find((intersection) => intersection.object.visible);

    return { position: found ? found.point.clone() : point, normal };
}
