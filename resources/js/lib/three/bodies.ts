import * as THREE from 'three';
import { archStations, loftMesh, type Section } from '@/lib/three/loft';
import type { Materials } from '@/lib/three/materials';
import {
    arch,
    box,
    cyl,
    extrude,
    grille,
    headlight,
    instanced,
    mirror,
    plate,
    polygon,
    silhouette,
    sphere,
    strut,
    taillight,
    torus,
    tube,
    wheel,
    type Point,
    type Point3,
    type Transform,
} from '@/lib/three/shapes';
import type { MachineKind } from '@/types';

/**
 * Where the engine sits in the body, how big it is, and which way it faces.
 * A scale of zero means there is no engine.
 */
export type EngineAnchor = {
    position: THREE.Vector3;
    scale: number;
    rotationY?: number;
    /** True when the engine is out in the open rather than under a cover. */
    exposed?: boolean;
};

/**
 * Build the body for the kind of machine into the group. +X is the front,
 * +Y is up, +Z is the right-hand side, and the ground is y = 0.
 */
export type BodyOptions = {
    /** Door count from the VIN decode, which picks two-door and regular-cab variants. */
    doors?: number | null;
};

export function buildBody(
    kind: MachineKind,
    m: Materials,
    body: THREE.Group,
    options: BodyOptions = {},
): EngineAnchor {
    const doors = options.doors ?? null;

    switch (kind) {
        case 'car':
            return buildCar(m, body, doors);
        case 'suv':
            return buildSuv(m, body, doors);
        case 'van':
            return buildVan(m, body);
        case 'ute':
            return buildUte(m, body, doors);
        case 'truck':
            return buildTruck(m, body);
        case 'bus':
            return buildBus(m, body);
        case 'motorcycle':
            return buildMotorcycle(m, body);
        case 'atv':
            return buildAtv(m, body);
        case 'tractor':
            return buildTractor(m, body);
        case 'mower':
            return buildMower(m, body);
        case 'outboard':
            return buildOutboard(m, body);
        case 'generator':
            return buildGenerator(m, body);
        case 'trailer':
            return buildTrailer(m, body);
        default:
            return buildGeneric(m, body);
    }
}

/* ------------------------------------------------------------------------ */
/* Shared road-vehicle furniture                                             */
/* ------------------------------------------------------------------------ */

type Road = {
    length: number;
    width: number;
    floor: number;
    wheelRadius: number;
    wheelWidth: number;
    wheelX: number[];
    belt: number;
};

/**
 * Door seams, handles, sills, bumpers, plates, wipers and the underbody
 * that every car-shaped thing shares.
 */
function roadFurniture(
    m: Materials,
    body: THREE.Group,
    r: Road,
    options: {
        doors: number[];
        handles: number[];
        handleY: number;
        wipers?: Point;
        rearLightY: number;
        frontLightY: number;
        offroad?: boolean;
        spokes?: number;
    },
): void {
    const half = r.width / 2;
    const front = r.length / 2;
    const rear = -r.length / 2;

    for (const x of options.doors) {
        for (const z of [half + 0.004, -half - 0.004]) {
            body.add(
                box(
                    0.008,
                    r.belt - r.floor - 0.12,
                    0.01,
                    m.plastic,
                    x,
                    (r.belt + r.floor) / 2,
                    z,
                ),
            );
        }
    }

    for (const x of options.handles) {
        for (const z of [half + 0.015, -half - 0.015]) {
            body.add(
                box(0.12, 0.025, 0.02, m.chrome, x, options.handleY, z, 0.008),
            );
        }
    }

    // Sills, underbody, exhaust.
    for (const z of [half - 0.02, -half + 0.02]) {
        body.add(
            box(
                r.length * 0.55,
                0.05,
                0.06,
                m.plastic,
                -0.1,
                r.floor + 0.03,
                z,
                0.01,
            ),
        );
    }
    body.add(
        box(
            r.length - 0.7,
            0.06,
            r.width - 0.35,
            m.plastic,
            0,
            r.floor - 0.01,
            0,
        ),
    );
    body.add(
        tube(
            [
                [0.6, r.floor - 0.06, 0.2],
                [-0.6, r.floor - 0.08, 0.4],
                [rear + 0.9, r.floor - 0.08, 0.55],
                [rear + 0.35, r.floor - 0.06, 0.6],
                [rear - 0.02, r.floor - 0.02, 0.6],
            ],
            0.028,
            m.heat,
            { segments: 24 },
        ),
    );
    body.add(
        cyl(0.08, 0.5, m.steel, 'x', rear + 0.9, r.floor - 0.08, 0.55, {
            segments: 20,
        }),
    );
    body.add(
        cyl(0.035, 0.08, m.chrome, 'x', rear - 0.02, r.floor - 0.02, 0.6, {
            open: true,
        }),
    );

    // Bumpers.
    body.add(
        box(
            0.14,
            0.26,
            r.width - 0.06,
            m.paintDark,
            front - 0.02,
            r.floor + 0.2,
            0,
            0.05,
        ),
    );
    body.add(
        box(
            0.14,
            0.26,
            r.width - 0.06,
            m.paintDark,
            rear + 0.02,
            r.floor + 0.2,
            0,
            0.05,
        ),
    );
    body.add(
        box(
            0.04,
            0.1,
            r.width * 0.6,
            m.plastic,
            front + 0.05,
            r.floor + 0.14,
            0,
        ),
    );

    // Lights and plates.
    for (const z of [0.62 * half, -0.62 * half]) {
        body.add(
            headlight(
                m,
                r.width * 0.25,
                0.14,
                front + 0.02,
                options.frontLightY,
                z,
            ),
        );
        body.add(
            taillight(
                m,
                r.width * 0.22,
                0.11,
                rear - 0.005,
                options.rearLightY,
                z,
            ),
        );
    }
    body.add(plate(m, front + 0.075, r.floor + 0.33));
    body.add(plate(m, rear - 0.075, options.rearLightY - 0.02, -1));

    if (options.wipers) {
        const [wx, wy] = options.wipers;

        for (const z of [-0.35, 0.3]) {
            const wiper = box(0.5, 0.012, 0.02, m.plastic, wx, wy, z);
            wiper.rotation.z = 0.6;
            wiper.rotation.y = -0.35;
            body.add(wiper);
        }
    }

    for (const x of r.wheelX) {
        body.add(
            wheel(
                m,
                r.wheelRadius,
                r.wheelWidth,
                x,
                half - r.wheelWidth / 2 - 0.02,
                { offroad: options.offroad, spokes: options.spokes },
            ),
        );
        body.add(
            wheel(
                m,
                r.wheelRadius,
                r.wheelWidth,
                x,
                -half + r.wheelWidth / 2 + 0.02,
                { offroad: options.offroad, spokes: options.spokes },
            ),
        );

        // Arch liners so you see darkness, not daylight, through the arch.
        body.add(
            cyl(
                r.wheelRadius + 0.06,
                r.width - 0.5,
                m.plastic,
                'z',
                x,
                r.wheelRadius,
                0,
                { segments: 24 },
            ),
        );
    }
}

/**
 * Seats, dashboard and a dark cabin so the tinted glass has something to
 * hide.
 */
/**
 * Everything is sized from the cabin: the floor sits just under the belt
 * line and nothing reaches the roof, however low the cabin is.
 */
function interior(
    m: Materials,
    body: THREE.Group,
    x: number,
    belt: number,
    top: number,
    length: number,
    width: number,
    rows = 2,
): void {
    const cabin = Math.max(0.3, top - belt);
    const floor = belt - 0.12;

    body.add(box(length, 0.16, width, m.plastic, x, floor, 0, 0.04));

    const seatWidth = width * 0.36;
    const seatHeight = 0.08;
    const seatTop = belt + cabin * 0.12;
    const backHeight = cabin * 0.5;
    const rowStep = length / (rows + 0.6);

    for (let row = 0; row < rows; row++) {
        const sx = x + length / 2 - rowStep * (row + 0.9);

        for (const z of [width * 0.24, -width * 0.24]) {
            body.add(
                box(
                    0.45,
                    seatHeight,
                    seatWidth,
                    m.fabric,
                    sx,
                    seatTop - seatHeight / 2,
                    z,
                    0.03,
                ),
            );
            body.add(
                box(
                    0.08,
                    backHeight,
                    seatWidth * 0.9,
                    m.fabric,
                    sx - 0.2,
                    seatTop + backHeight / 2 - 0.02,
                    z,
                    0.03,
                ),
            );
        }
    }

    body.add(
        box(
            0.3,
            cabin * 0.22,
            width * 0.9,
            m.plastic,
            x + length / 2 - 0.15,
            belt + cabin * 0.12,
            0,
            0.03,
        ),
    );

    const wheelRadius = Math.min(0.16, cabin * 0.24);
    const wheel = torus(
        wheelRadius,
        0.018,
        m.plastic,
        'x',
        x + length / 2 - 0.38,
        belt + cabin * 0.38,
        width * 0.24,
    );
    wheel.rotation.z = -0.5;
    body.add(wheel);
}

function pillars(
    m: Materials,
    body: THREE.Group,
    segments: [Point, Point][],
    width: number,
    thickness = 0.06,
): void {
    for (const [from, to] of segments) {
        for (const z of [width / 2 - 0.02, -width / 2 + 0.02]) {
            body.add(strut(from, to, thickness, 0.05, m.paintDark, z));
        }
    }
}

function roofPanel(
    m: Materials,
    body: THREE.Group,
    from: number,
    to: number,
    y: number,
    width: number,
): void {
    body.add(
        box(from - to, 0.035, width, m.paint, (from + to) / 2, y, 0, 0.012),
    );
}

/* ------------------------------------------------------------------------ */
/* Cars                                                                      */
/* ------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------ */
/* Lofted cars                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Linear interpolation through [x, value] keyframes.
 */
function keyed(points: Point[], x: number): number {
    const sorted = [...points].sort((a, b) => a[0] - b[0]);

    if (x <= sorted[0][0]) {
        return sorted[0][1];
    }

    for (let i = 1; i < sorted.length; i++) {
        if (x <= sorted[i][0]) {
            const [x0, y0] = sorted[i - 1];
            const [x1, y1] = sorted[i];
            const t = (x - x0) / (x1 - x0);

            return y0 + (y1 - y0) * t;
        }
    }

    return sorted[sorted.length - 1][1];
}

type LoftedSpec = {
    length: number;
    floor: number;
    wheelRadius: number;
    wheelWidth: number;
    archRadius: number;
    wheelX: [number, number];
    /** Belt, bonnet and deck height along the length. */
    top: Point[];
    /** Half width along the length. */
    halfWidth: Point[];
    squareness: number;
    tuck: number;
    taper: number;
    /** Nose and tail cap sections. */
    nose: { top: number; bottom: number; halfWidth: number };
    tail: { top: number; bottom: number; halfWidth: number };
    /** Glasshouse roof line, front to rear. */
    glass: Point[];
    glassWidth: number;
    glassTaper: number;
    glassSquareness: number;
    roof: [number, number];
    pillars: [Point, Point][];
    seams: number[];
    handles: number[];
    handleY: number;
    lightY: number;
    rearLightY: number;
    seatRows: number;
    offroad?: boolean;
    engine: EngineAnchor;
};

/**
 * A car-shaped body skinned from cross-sections: a rounded nose and tail in
 * plan, sides that tuck under, a crowned bonnet and deck, round wheel
 * openings, and a glasshouse that leans inward under a separate roof skin.
 */
function loftedBody(
    m: Materials,
    body: THREE.Group,
    spec: LoftedSpec,
): EngineAnchor {
    const front = spec.length / 2;
    const rear = -spec.length / 2;
    const section = (
        x: number,
        bottom: number,
        overrides: Partial<Section> = {},
    ): Section => ({
        x,
        bottom,
        top: keyed(spec.top, x),
        halfWidth: keyed(spec.halfWidth, x),
        squareness: spec.squareness,
        tuck: spec.tuck,
        taper: spec.taper,
        waist: 0.62,
        ...overrides,
    });

    // Stations every so often along the length, replaced by arch stations
    // wherever a wheel opening is.
    const stations: Section[] = [
        {
            x: front,
            bottom: spec.nose.bottom,
            top: spec.nose.top,
            halfWidth: spec.nose.halfWidth,
            squareness: 3.2,
            tuck: spec.tuck,
            taper: 0.12,
            waist: 0.55,
        },
    ];
    const step = 0.22;
    for (let x = front - 0.14; x > rear + 0.14; x -= step) {
        const inArch = spec.wheelX.some(
            (wx) => Math.abs(x - wx) < spec.archRadius + 0.05,
        );

        if (!inArch) {
            stations.push(section(x, spec.floor));
        }
    }
    for (const wx of spec.wheelX) {
        stations.push(
            ...archStations(
                wx,
                spec.archRadius,
                spec.wheelRadius,
                (x, bottom) =>
                    section(x, bottom, {
                        halfWidth: keyed(spec.halfWidth, x) + 0.015,
                    }),
            ),
        );
    }
    stations.push({
        x: rear,
        bottom: spec.tail.bottom,
        top: spec.tail.top,
        halfWidth: spec.tail.halfWidth,
        squareness: 3.4,
        tuck: spec.tuck,
        taper: 0.1,
        waist: 0.55,
    });
    stations.sort((a, b) => b.x - a.x);

    body.add(
        loftMesh(stations, m.paint, {
            segments: 56,
            capStart: true,
            capEnd: true,
        }),
    );

    // Glasshouse, roof skin and pillars.
    const glass: Section[] = spec.glass.map(([x, top]) => ({
        x,
        bottom: keyed(spec.top, x) - 0.08,
        top,
        halfWidth: keyed(spec.halfWidth, x) * spec.glassWidth,
        squareness: spec.glassSquareness,
        taper: spec.glassTaper,
        tuck: 0,
        waist: 0.05,
    }));
    body.add(loftMesh(glass, m.glass, { segments: 40 }));

    const roof = glass
        .filter(
            (s) => s.x <= spec.roof[0] + 0.001 && s.x >= spec.roof[1] - 0.001,
        )
        .map((s) => ({
            ...s,
            top: s.top + 0.014,
            bottom: s.bottom + 0.014,
            halfWidth: s.halfWidth * 1.006,
        }));
    if (roof.length >= 2) {
        body.add(
            loftMesh(roof, m.paint, {
                segments: 24,
                arc: [Math.PI * 0.3, Math.PI * 0.7],
            }),
        );
        body.add(
            loftMesh(roof, m.paint, {
                segments: 24,
                arc: [Math.PI * 0.3, Math.PI * 0.7],
                flip: true,
            }),
        );
    }

    const lean =
        Math.atan(
            (spec.glassTaper * keyed(spec.halfWidth, 0) * spec.glassWidth) /
                0.5,
        ) * 0.7;
    for (const [from, to] of spec.pillars) {
        const midX = (from[0] + to[0]) / 2;
        const midY = (from[1] + to[1]) / 2;
        const belt = keyed(spec.top, midX);
        const hw = keyed(spec.halfWidth, midX) * spec.glassWidth;
        const roofY = keyed(spec.glass, midX);
        const frac = Math.min(
            1,
            Math.max(0, (midY - belt) / Math.max(0.1, roofY - belt)),
        );
        const z = hw * (1 - spec.glassTaper * frac * 0.85) - 0.005;

        for (const side of [1, -1]) {
            const pillar = strut(from, to, 0.07, 0.05, m.paintDark, side * z);
            pillar.rotation.x = -side * lean;
            body.add(pillar);
        }
    }

    const cabinFront = spec.glass[0][0];
    const cabinRear = spec.glass[spec.glass.length - 1][0];
    interior(
        m,
        body,
        (cabinFront + cabinRear) / 2 - 0.1,
        keyed(spec.top, (cabinFront + cabinRear) / 2),
        Math.max(...spec.glass.map(([, y]) => y)),
        cabinFront - cabinRear - 0.5,
        keyed(spec.halfWidth, 0) * spec.glassWidth * 2 - 0.2,
        spec.seatRows,
    );
    body.add(
        box(
            0.1,
            0.03,
            0.06,
            m.paintDark,
            spec.roof[1] + 0.25,
            keyed(spec.glass, spec.roof[1] + 0.25) + 0.03,
            0,
            0.01,
        ),
    );

    // Doors and handles lean with the sides.
    const sideLean = Math.atan((spec.tuck * keyed(spec.halfWidth, 0)) / 0.7);
    for (const x of spec.seams) {
        const belt = keyed(spec.top, x);
        const hw = keyed(spec.halfWidth, x);
        for (const side of [1, -1]) {
            const seam = box(
                0.008,
                belt - spec.floor - 0.2,
                0.024,
                m.plastic,
                x,
                (belt + spec.floor) / 2 + 0.05,
                side * (hw - 0.035),
            );
            seam.rotation.x = side * sideLean;
            body.add(seam);
        }
    }
    for (const x of spec.handles) {
        const hw = keyed(spec.halfWidth, x);
        for (const side of [1, -1]) {
            body.add(
                box(
                    0.13,
                    0.026,
                    0.03,
                    m.chrome,
                    x,
                    spec.handleY,
                    side * (hw - 0.005),
                    0.01,
                ),
            );
        }
    }

    // Front: headlights swept round the corners, grille, valance, fogs, plate.
    const noseHw = spec.nose.halfWidth;
    for (const side of [1, -1]) {
        const light = headlight(
            m,
            0.5,
            0.15,
            front - 0.08,
            spec.lightY,
            side * (noseHw - 0.12),
        );
        light.rotation.y = -side * 0.55;
        light.rotation.z = 0.12;
        body.add(light);
        const tail = taillight(
            m,
            0.42,
            0.13,
            rear + 0.05,
            spec.rearLightY,
            side * (spec.tail.halfWidth - 0.1),
        );
        tail.rotation.y = side * 0.5;
        body.add(tail);
        body.add(
            cyl(
                0.045,
                0.03,
                m.lens,
                'x',
                front - 0.02,
                spec.floor + 0.2,
                side * (noseHw - 0.28),
            ),
        );
        body.add(
            cyl(
                0.035,
                0.1,
                m.chrome,
                'x',
                rear - 0.02,
                spec.floor + 0.02,
                side * 0.45,
                { open: true },
            ),
        );
    }
    body.add(
        box(
            0.05,
            0.22,
            0.7,
            m.chrome,
            front + 0.005,
            spec.lightY - 0.02,
            0,
            0.03,
        ),
    );
    body.add(
        box(0.05, 0.16, 0.62, m.plastic, front + 0.02, spec.lightY - 0.02, 0),
    );
    body.add(
        box(
            0.05,
            0.14,
            1.1,
            m.plastic,
            front + 0.015,
            spec.floor + 0.2,
            0,
            0.02,
        ),
    );
    body.add(
        box(
            0.1,
            0.1,
            noseHw * 1.9,
            m.paintDark,
            front - 0.03,
            spec.floor + 0.06,
            0,
            0.03,
        ),
    );
    body.add(
        box(
            0.1,
            0.1,
            spec.tail.halfWidth * 1.9,
            m.paintDark,
            rear + 0.03,
            spec.floor + 0.06,
            0,
            0.03,
        ),
    );
    body.add(plate(m, front + 0.03, spec.floor + 0.38));
    body.add(plate(m, rear - 0.03, spec.rearLightY - 0.02, -1));
    body.add(taillight(m, 0.3, 0.03, rear + 0.35, spec.tail.top + 0.01, 0));

    // Mirrors, wipers, sills, wheels, arches, underbody, exhaust.
    const mirrorX = cabinFront - 0.15;
    for (const side of [1, -1]) {
        body.add(
            mirror(
                m,
                mirrorX,
                keyed(spec.top, mirrorX) + 0.1,
                side * (keyed(spec.halfWidth, mirrorX) + 0.04),
            ),
        );
        const sill = box(
            spec.wheelX[0] - spec.wheelX[1] - spec.archRadius * 2 - 0.1,
            0.05,
            0.05,
            m.plastic,
            (spec.wheelX[0] + spec.wheelX[1]) / 2,
            spec.floor + 0.02,
            side * (keyed(spec.halfWidth, 0) * (1 - spec.tuck) - 0.01),
            0.01,
        );
        body.add(sill);
    }
    for (const z of [-0.35, 0.3]) {
        const wiper = box(
            0.5,
            0.012,
            0.02,
            m.plastic,
            cabinFront - 0.05,
            keyed(spec.top, cabinFront) + 0.02,
            z,
        );
        wiper.rotation.z = 0.55;
        wiper.rotation.y = -0.35;
        body.add(wiper);
    }
    for (const x of spec.wheelX) {
        const hw = keyed(spec.halfWidth, x) + 0.015;
        body.add(
            wheel(
                m,
                spec.wheelRadius,
                spec.wheelWidth,
                x,
                hw - spec.wheelWidth / 2 - 0.015,
                { offroad: spec.offroad, spokes: spec.offroad ? 6 : 5 },
            ),
        );
        body.add(
            wheel(
                m,
                spec.wheelRadius,
                spec.wheelWidth,
                x,
                -hw + spec.wheelWidth / 2 + 0.015,
                { offroad: spec.offroad, spokes: spec.offroad ? 6 : 5 },
            ),
        );
        body.add(
            cyl(
                spec.archRadius + 0.02,
                hw * 2 - 0.5,
                m.plastic,
                'z',
                x,
                spec.wheelRadius,
                0,
                { segments: 24 },
            ),
        );
        for (const side of [1, -1]) {
            body.add(
                arch(
                    m,
                    spec.archRadius + 0.01,
                    spec.offroad ? 0.04 : 0.02,
                    x,
                    spec.wheelRadius,
                    side * hw,
                    spec.offroad ? m.plastic : m.paint,
                ),
            );
        }
    }
    body.add(
        box(
            spec.length - 0.8,
            0.06,
            keyed(spec.halfWidth, 0) * 1.6,
            m.plastic,
            0,
            spec.floor - 0.01,
            0,
        ),
    );
    body.add(
        tube(
            [
                [0.8, spec.floor - 0.06, 0.2],
                [-0.6, spec.floor - 0.08, 0.4],
                [rear + 0.9, spec.floor - 0.08, 0.5],
                [rear + 0.1, spec.floor - 0.04, 0.45],
            ],
            0.028,
            m.heat,
            { segments: 24 },
        ),
    );
    body.add(
        cyl(0.08, 0.5, m.steel, 'x', rear + 0.9, spec.floor - 0.08, 0.5, {
            segments: 20,
        }),
    );

    return spec.engine;
}

function buildCar(
    m: Materials,
    body: THREE.Group,
    doors: number | null,
): EngineAnchor {
    const coupe = doors !== null && doors <= 2;

    return loftedBody(m, body, {
        length: 4.9,
        floor: 0.25,
        wheelRadius: 0.36,
        wheelWidth: 0.24,
        archRadius: 0.44,
        wheelX: [1.45, -1.45],
        top: [
            [2.45, 0.6],
            [2.3, 0.7],
            [2.0, 0.77],
            [1.45, 0.84],
            [0.95, 0.89],
            [0.75, 0.9],
            [0, 0.92],
            [-0.9, 0.95],
            [-1.45, 0.99],
            [-1.9, 1.03],
            [-2.2, 1.02],
            [-2.45, 0.95],
        ],
        halfWidth: [
            [2.45, 0.72],
            [2.25, 0.85],
            [2.0, 0.9],
            [1.45, 0.925],
            [0.9, 0.92],
            [0, 0.92],
            [-0.9, 0.93],
            [-1.45, 0.94],
            [-1.9, 0.91],
            [-2.2, 0.87],
            [-2.45, 0.74],
        ],
        squareness: 4.6,
        tuck: 0.12,
        taper: 0.05,
        nose: { top: 0.58, bottom: 0.3, halfWidth: 0.7 },
        tail: { top: 0.9, bottom: 0.34, halfWidth: 0.72 },
        glass: [
            [0.8, 0.95],
            [0.55, 1.12],
            [0.3, 1.28],
            [0.08, 1.37],
            [-0.2, 1.4],
            [-0.9, 1.4],
            [-1.3, 1.28],
            [-1.55, 1.12],
            [-1.72, 1.0],
        ],
        glassWidth: 0.93,
        glassTaper: 0.32,
        glassSquareness: 3.2,
        roof: [0.08, -0.9],
        pillars: [
            [
                [0.8, 0.92],
                [0.1, 1.36],
            ],
            [
                [coupe ? -0.8 : -0.45, 0.93],
                [coupe ? -0.8 : -0.45, 1.39],
            ],
            [
                [-0.9, 1.4],
                [-1.68, 1.0],
            ],
        ],
        seams: coupe ? [0.6, -0.8] : [0.6, -0.45, -1.55],
        handles: coupe ? [-0.35] : [-0.05, -1.15],
        handleY: 0.82,
        lightY: 0.66,
        rearLightY: 0.88,
        seatRows: 2,
        engine: { position: new THREE.Vector3(1.6, 0.5, 0), scale: 0.6 },
    });
}

function buildSuv(
    m: Materials,
    body: THREE.Group,
    doors: number | null,
): EngineAnchor {
    const threeDoor = doors !== null && doors <= 3;

    const anchor = loftedBody(m, body, {
        length: 4.8,
        floor: 0.3,
        wheelRadius: 0.4,
        wheelWidth: 0.27,
        archRadius: 0.5,
        wheelX: [1.42, -1.42],
        top: [
            [2.4, 0.86],
            [2.2, 0.98],
            [1.9, 1.02],
            [1.0, 1.04],
            [0, 1.05],
            [-1.42, 1.06],
            [-2.2, 1.06],
            [-2.4, 1.0],
        ],
        halfWidth: [
            [2.4, 0.8],
            [2.2, 0.92],
            [1.9, 0.95],
            [0, 0.95],
            [-1.42, 0.96],
            [-2.2, 0.93],
            [-2.4, 0.82],
        ],
        squareness: 5.4,
        tuck: 0.1,
        taper: 0.04,
        nose: { top: 0.84, bottom: 0.34, halfWidth: 0.78 },
        tail: { top: 0.98, bottom: 0.36, halfWidth: 0.8 },
        glass: [
            [1.0, 1.1],
            [0.75, 1.32],
            [0.45, 1.55],
            [0.2, 1.66],
            [-0.5, 1.68],
            [-1.6, 1.68],
            [-2.1, 1.64],
            [-2.3, 1.35],
            [-2.36, 1.12],
        ],
        glassWidth: 0.95,
        glassTaper: 0.18,
        glassSquareness: 4.6,
        roof: [0.2, -2.1],
        pillars: [
            [
                [1.0, 1.06],
                [0.25, 1.64],
            ],
            [
                [threeDoor ? -0.9 : -0.4, 1.07],
                [threeDoor ? -0.9 : -0.4, 1.66],
            ],
            [
                [-1.35, 1.07],
                [-1.35, 1.66],
            ],
            [
                [-2.1, 1.64],
                [-2.35, 1.12],
            ],
        ],
        seams: threeDoor ? [0.7, -0.9] : [0.7, -0.4, -1.35],
        handles: threeDoor ? [-0.2] : [0.05, -0.95],
        handleY: 0.94,
        lightY: 0.82,
        rearLightY: 1.2,
        seatRows: 3,
        offroad: true,
        engine: { position: new THREE.Vector3(1.6, 0.62, 0), scale: 0.66 },
    });

    // Roof rails and side steps.
    for (const side of [1, -1]) {
        body.add(
            box(2.0, 0.05, 0.05, m.plastic, -0.85, 1.74, side * 0.72, 0.02),
        );
        for (const x of [-0.05, -1.65]) {
            body.add(box(0.06, 0.05, 0.05, m.plastic, x, 1.71, side * 0.72));
        }
        body.add(box(1.9, 0.06, 0.16, m.plastic, 0, 0.32, side * 0.96, 0.02));
    }

    return anchor;
}

function buildVan(m: Materials, body: THREE.Group): EngineAnchor {
    const r: Road = {
        length: 5.2,
        width: 1.98,
        floor: 0.25,
        wheelRadius: 0.36,
        wheelWidth: 0.24,
        wheelX: [1.65, -1.55],
        belt: 1.0,
    };
    const half = r.width / 2;

    body.add(
        extrude(
            silhouette(
                [
                    [2.6, r.floor],
                    [2.63, 0.6],
                    [2.55, 0.9],
                    [2.3, 1.02],
                    [-2.55, 1.04],
                    [-2.6, 0.9],
                    [-2.6, r.floor],
                ],
                [
                    { x: 1.65, radius: 0.44 },
                    { x: -1.55, radius: 0.44 },
                ],
                r.floor,
            ),
            r.width,
            m.paint,
            { bevel: 0.05 },
        ),
    );

    const cabinWidth = r.width * 0.94;
    body.add(
        extrude(
            polygon([
                [2.25, 1.0],
                [1.55, 1.95],
                [-2.45, 2.05],
                [-2.55, 1.02],
            ]),
            cabinWidth,
            m.paint,
            { bevel: 0.05 },
        ),
    );

    // Windscreen and the front side windows, cut into the painted upper.
    body.add(
        strut([2.24, 1.06], [1.58, 1.9], 0.02, cabinWidth * 0.86, m.glass, 0),
    );
    for (const z of [cabinWidth / 2 + 0.005, -cabinWidth / 2 - 0.005]) {
        body.add(box(1.1, 0.7, 0.02, m.glass, 0.95, 1.5, z, 0.02));
        body.add(box(0.008, 1.1, 0.02, m.plastic, 0.35, 1.5, z * 1.01));
        body.add(box(0.008, 0.9, 0.02, m.plastic, 1.6, 1.5, z * 1.01));
        body.add(box(2.6, 0.02, 0.02, m.plastic, -1.1, 1.62, z * 1.01));
        body.add(box(0.008, 1.3, 0.02, m.plastic, -0.9, 1.4, z * 1.01));
    }
    body.add(box(0.02, 0.9, cabinWidth * 0.8, m.glass, -2.56, 1.55, 0));
    body.add(box(0.008, 1.0, 0.02, m.plastic, -2.57, 1.5, 0));

    interior(m, body, 1.3, 1.02, 1.95, 1.5, cabinWidth - 0.1, 1);
    body.add(grille(m, 1.1, 0.26, 2.62, 0.82, 0, 4));

    roadFurniture(m, body, r, {
        doors: [0.4, -0.9, -2.4],
        handles: [0.6, -0.5],
        handleY: 0.95,
        wipers: [2.05, 1.05],
        frontLightY: 0.84,
        rearLightY: 1.2,
    });

    for (const z of [half + 0.05, -half - 0.05]) {
        body.add(mirror(m, 1.9, 1.35, z * 1.07));
    }

    return { position: new THREE.Vector3(1.9, 0.62, 0), scale: 0.62 };
}

/**
 * A heavy-duty pickup. The decoded door count picks a regular cab with a
 * long bed or a crew cab with a shorter one.
 */
function buildUte(
    m: Materials,
    body: THREE.Group,
    doors: number | null,
): EngineAnchor {
    const crew = (doors ?? 4) >= 4;
    const r: Road = {
        length: 5.7,
        width: 2.0,
        floor: 0.36,
        wheelRadius: 0.43,
        wheelWidth: 0.3,
        wheelX: [1.8, -1.75],
        belt: 1.16,
    };
    const half = r.width / 2;
    const front = r.length / 2;
    const rear = -r.length / 2;
    const cabFront = 1.1;
    const cabRear = crew ? -0.95 : -0.2;
    const bedFront = cabRear - 0.08;
    const roof = 1.9;

    body.add(
        extrude(
            silhouette(
                [
                    [front, r.floor],
                    [front + 0.04, 0.72],
                    [front, 1.06],
                    [front - 0.18, 1.19],
                    [cabFront + 0.1, 1.21],
                    [cabRear, 1.22],
                    [cabRear - 0.03, r.belt],
                    [rear + 0.06, r.belt],
                    [rear, 1.02],
                    [rear, r.floor],
                ],
                [
                    { x: r.wheelX[0], radius: 0.53 },
                    { x: r.wheelX[1], radius: 0.53 },
                ],
                r.floor,
            ),
            r.width,
            m.paint,
            { bevel: 0.05 },
        ),
    );

    // Cab: upright windscreen, flat roof, big square glass.
    const cabinWidth = r.width * 0.9;
    const screenTop: Point = [cabFront - 0.5, roof - 0.04];
    body.add(
        extrude(
            polygon([
                [cabFront, 1.18],
                screenTop,
                [cabRear + 0.1, roof - 0.02],
                [cabRear, 1.18],
            ]),
            cabinWidth,
            m.glass,
            { bevel: 0.02 },
        ),
    );
    roofPanel(
        m,
        body,
        cabFront - 0.52,
        cabRear + 0.08,
        roof,
        cabinWidth + 0.02,
    );
    const pillarSegments: [Point, Point][] = [
        [[cabFront, 1.18], screenTop],
        [
            [cabRear, 1.18],
            [cabRear + 0.1, roof - 0.02],
        ],
    ];
    if (crew) {
        const mid = (cabFront - 0.5 + cabRear) / 2;
        pillarSegments.push([
            [mid, 1.19],
            [mid, roof - 0.03],
        ]);
    }
    pillars(m, body, pillarSegments, cabinWidth);
    interior(
        m,
        body,
        (cabFront - 0.5 + cabRear) / 2,
        1.18,
        roof,
        cabFront - 0.5 - cabRear,
        cabinWidth - 0.1,
        crew ? 2 : 1,
    );

    // Cab roof marker lights and a bonnet bulge.
    for (const z of [-0.35, 0, 0.35]) {
        body.add(
            box(
                0.06,
                0.03,
                0.12,
                m.tailLens,
                cabFront - 0.5,
                roof + 0.03,
                z,
                0.01,
            ),
        );
    }
    body.add(box(1.1, 0.05, 0.7, m.paint, cabFront + 0.75, 1.23, 0, 0.02));
    body.add(box(0.008, 0.01, cabinWidth, m.plastic, cabFront + 0.05, 1.22, 0));

    // Crosshair grille in a chrome surround, big headlights, chrome bumper.
    const grilleY = 0.9;
    body.add(box(0.06, 0.6, 1.25, m.plastic, front + 0.01, grilleY, 0));
    body.add(box(0.03, 0.62, 0.05, m.chrome, front + 0.05, grilleY, 0.62));
    body.add(box(0.03, 0.62, 0.05, m.chrome, front + 0.05, grilleY, -0.62));
    body.add(box(0.03, 0.05, 1.3, m.chrome, front + 0.05, grilleY + 0.3, 0));
    body.add(box(0.03, 0.05, 1.3, m.chrome, front + 0.05, grilleY - 0.3, 0));
    body.add(box(0.04, 0.6, 0.09, m.chrome, front + 0.05, grilleY, 0));
    body.add(box(0.04, 0.09, 1.25, m.chrome, front + 0.05, grilleY, 0));
    const mesh = new THREE.BoxGeometry(0.02, 0.012, 0.55);
    const meshRows: Transform[] = [];
    for (let i = 0; i < 6; i++) {
        for (const z of [0.33, -0.33]) {
            meshRows.push({ x: front + 0.03, y: grilleY - 0.22 + i * 0.09, z });
        }
    }
    body.add(instanced(mesh, m.plastic, meshRows));
    for (const z of [0.78, -0.78]) {
        body.add(headlight(m, 0.34, 0.3, front + 0.02, grilleY, z));
    }
    body.add(
        box(0.22, 0.34, r.width + 0.04, m.chrome, front - 0.04, 0.56, 0, 0.05),
    );
    body.add(box(0.06, 0.14, 1.0, m.plastic, front + 0.09, 0.5, 0));
    for (const z of [0.55, -0.55]) {
        body.add(cyl(0.05, 0.03, m.lens, 'x', front + 0.1, 0.5, z));
    }
    body.add(plate(m, front + 0.1, 0.72));
    for (const z of [0.5, -0.5]) {
        body.add(
            box(0.12, 0.05, 0.05, m.steel, front + 0.02, r.floor + 0.02, z),
        );
    }

    // Tub: liner, bulkhead, rail caps, tailgate, step bumper, hitch.
    const bedLength = bedFront - rear;
    body.add(
        box(
            bedLength - 0.1,
            0.08,
            r.width - 0.16,
            m.plastic,
            (bedFront + rear) / 2,
            r.belt,
            0,
            0.02,
        ),
    );
    body.add(box(0.08, 0.5, r.width - 0.2, m.plastic, bedFront + 0.02, 0.9, 0));
    for (const z of [half - 0.05, -half + 0.05]) {
        body.add(
            box(
                bedLength - 0.05,
                0.03,
                0.1,
                m.plastic,
                (bedFront + rear) / 2,
                r.belt + 0.02,
                z,
                0.01,
            ),
        );
    }
    body.add(
        box(
            0.02,
            0.008,
            r.width * 0.96,
            m.plastic,
            rear - 0.01,
            r.belt - 0.02,
            0,
        ),
    );
    body.add(box(0.008, 0.7, 0.02, m.plastic, rear + 0.03, 0.8, half * 1.01));
    body.add(box(0.008, 0.7, 0.02, m.plastic, rear + 0.03, 0.8, -half * 1.01));
    body.add(
        box(0.03, 0.03, 0.25, m.paint, rear - 0.02, r.belt - 0.12, 0, 0.01),
    );
    body.add(
        box(0.2, 0.3, r.width + 0.02, m.chrome, rear + 0.02, 0.55, 0, 0.04),
    );
    body.add(box(0.1, 0.02, 0.5, m.plastic, rear - 0.06, 0.7, 0));
    body.add(box(0.12, 0.12, 0.12, m.steel, rear - 0.1, r.floor + 0.02, 0));
    body.add(plate(m, rear - 0.11, 0.85, -1));
    for (const z of [0.62 * half, -0.62 * half]) {
        body.add(taillight(m, 0.16, 0.36, rear - 0.005, 0.95, z * 1.45));
    }

    // Doors, handles, running boards, flares, mirrors.
    const seams = crew
        ? [cabFront - 0.45, (cabFront - 0.45 + cabRear) / 2, cabRear]
        : [cabFront - 0.45, cabRear];
    for (const x of seams) {
        for (const z of [half + 0.004, -half - 0.004]) {
            body.add(
                box(
                    0.008,
                    r.belt - r.floor - 0.15,
                    0.01,
                    m.plastic,
                    x,
                    (r.belt + r.floor) / 2 + 0.02,
                    z,
                ),
            );
        }
    }
    const handles = crew
        ? [cabFront - 0.75, (cabFront - 0.45 + cabRear) / 2 - 0.3]
        : [cabFront - 0.8];
    for (const x of handles) {
        for (const z of [half + 0.015, -half - 0.015]) {
            body.add(box(0.14, 0.03, 0.02, m.chrome, x, 1.0, z, 0.008));
        }
    }
    for (const z of [half + 0.1, -half - 0.1]) {
        body.add(
            cyl(
                0.04,
                cabFront - cabRear + 0.4,
                m.chrome,
                'x',
                (cabFront + cabRear) / 2,
                r.floor + 0.05,
                z,
                { segments: 16 },
            ),
        );
        body.add(
            box(
                0.05,
                0.14,
                0.06,
                m.steel,
                cabFront - 0.3,
                r.floor + 0.12,
                z * 0.92,
            ),
        );
        body.add(
            box(
                0.05,
                0.14,
                0.06,
                m.steel,
                cabRear + 0.3,
                r.floor + 0.12,
                z * 0.92,
            ),
        );
        body.add(mirror(m, cabFront - 0.15, 1.42, z * 0.96));
    }
    for (const x of r.wheelX) {
        for (const z of [half, -half]) {
            body.add(arch(m, 0.57, 0.045, x, r.floor, z));
        }
        body.add(
            wheel(
                m,
                r.wheelRadius,
                r.wheelWidth,
                x,
                half - r.wheelWidth / 2 - 0.02,
                { offroad: true, spokes: 6 },
            ),
        );
        body.add(
            wheel(
                m,
                r.wheelRadius,
                r.wheelWidth,
                x,
                -half + r.wheelWidth / 2 + 0.02,
                { offroad: true, spokes: 6 },
            ),
        );
        body.add(
            cyl(
                r.wheelRadius + 0.08,
                r.width - 0.6,
                m.plastic,
                'z',
                x,
                r.wheelRadius,
                0,
                { segments: 24 },
            ),
        );
    }
    for (const z of [-0.35, 0.3]) {
        const wiper = box(
            0.55,
            0.012,
            0.02,
            m.plastic,
            cabFront - 0.08,
            1.2,
            z,
        );
        wiper.rotation.z = 0.7;
        wiper.rotation.y = -0.3;
        body.add(wiper);
    }

    // Underneath: frame, sills, exhaust, fuel tank.
    body.add(
        box(
            r.length - 0.8,
            0.08,
            r.width - 0.4,
            m.plastic,
            0,
            r.floor - 0.02,
            0,
        ),
    );
    for (const z of [0.5, -0.5]) {
        body.add(box(r.length - 1.0, 0.16, 0.08, m.iron, 0, r.floor - 0.06, z));
    }
    body.add(box(1.0, 0.25, 0.6, m.plastic, -0.6, r.floor - 0.1, 0.35, 0.04));
    body.add(
        tube(
            [
                [1.0, r.floor - 0.1, 0.25],
                [-0.6, r.floor - 0.14, 0.6],
                [rear + 0.9, r.floor - 0.14, 0.7],
                [rear - 0.05, r.floor - 0.08, 0.75],
            ],
            0.035,
            m.heat,
            { segments: 24 },
        ),
    );
    body.add(
        cyl(0.1, 0.6, m.steel, 'x', rear + 1.0, r.floor - 0.14, 0.7, {
            segments: 20,
        }),
    );
    body.add(
        cyl(0.045, 0.1, m.chrome, 'x', rear - 0.06, r.floor - 0.08, 0.75, {
            open: true,
        }),
    );

    return { position: new THREE.Vector3(front - 0.95, 0.78, 0), scale: 0.72 };
}

/* ------------------------------------------------------------------------ */
/* Trucks and buses                                                          */
/* ------------------------------------------------------------------------ */

function chassisRails(
    m: Materials,
    body: THREE.Group,
    from: number,
    to: number,
    y: number,
    spread: number,
    crossmembers: number,
): void {
    const length = from - to;
    const centre = (from + to) / 2;

    for (const z of [spread, -spread]) {
        body.add(box(length, 0.26, 0.08, m.iron, centre, y, z));
    }

    for (let i = 0; i <= crossmembers; i++) {
        body.add(
            box(
                0.08,
                0.2,
                spread * 2,
                m.iron,
                to + (length / crossmembers) * i,
                y,
                0,
            ),
        );
    }
}

function buildTruck(m: Materials, body: THREE.Group): EngineAnchor {
    const width = 2.45;
    const half = width / 2;
    const R = 0.5;

    chassisRails(m, body, 3.6, -4.0, 0.72, 0.45, 6);

    // Cab-over cab.
    body.add(
        extrude(
            polygon([
                [3.75, 0.6],
                [3.8, 1.25],
                [3.76, 1.75],
                [3.62, 2.35],
                [3.32, 2.85],
                [3.1, 2.98],
                [1.6, 3.0],
                [1.55, 0.6],
            ]),
            width,
            m.paint,
            { bevel: 0.06 },
        ),
    );
    body.add(strut([3.65, 1.82], [3.34, 2.8], 0.025, width * 0.86, m.glass, 0));
    for (const z of [half + 0.004, -half - 0.004]) {
        body.add(box(1.0, 0.85, 0.02, m.glass, 2.6, 2.3, z, 0.02));
        body.add(box(0.008, 2.3, 0.02, m.plastic, 2.1, 1.75, z * 1.01));
        body.add(box(0.12, 0.03, 0.02, m.chrome, 2.7, 1.55, z * 1.02, 0.01));
        body.add(box(0.5, 0.05, 0.4, m.steel, 2.8, 0.7, z * 1.1));
        body.add(box(0.5, 0.05, 0.4, m.steel, 2.8, 1.05, z * 1.1));
        body.add(box(0.08, 1.4, 0.05, m.plastic, 3.55, 2.1, z * 1.25));
        body.add(box(0.06, 0.5, 0.35, m.paintDark, 3.55, 2.4, z * 1.35, 0.02));
    }
    body.add(grille(m, 1.9, 0.5, 3.8, 1.15, 0, 5));
    body.add(box(0.04, 0.28, 2.1, m.plastic, 3.82, 1.55, 0));
    body.add(box(0.2, 0.32, width, m.paintDark, 3.72, 0.5, 0, 0.05));
    body.add(box(0.25, 0.08, 2.2, m.plastic, 3.85, 3.02, 0, 0.02));
    body.add(box(0.9, 0.55, 2.0, m.paint, 2.0, 3.25, 0, 0.1));
    for (const z of [0.8, -0.8]) {
        body.add(headlight(m, 0.5, 0.2, 3.82, 0.78, z));
    }
    body.add(plate(m, 3.86, 0.36));
    interior(m, body, 2.6, 1.85, 2.95, 1.6, width - 0.3, 1);

    // Exhaust stack, air tanks, fuel tank, battery box.
    body.add(cyl(0.06, 2.6, m.steel, 'y', 1.45, 2.2, half - 0.2));
    body.add(box(0.14, 1.4, 0.16, m.steel, 1.45, 2.4, half - 0.2, 0.03));
    body.add(cyl(0.3, 1.2, m.alloy, 'x', 0.6, 0.55, half - 0.28));
    body.add(box(0.6, 0.45, 0.5, m.plastic, 0.4, 0.55, -half + 0.28, 0.03));
    body.add(cyl(0.14, 0.7, m.steel, 'x', -0.4, 0.5, -half + 0.4));
    body.add(cyl(0.14, 0.7, m.steel, 'x', -0.4, 0.5, -half + 0.72));

    // The box body with its ribs and rear doors.
    body.add(box(4.9, 2.5, width, m.paintDark, -1.5, 2.1, 0, 0.04));
    const rib = new THREE.BoxGeometry(0.03, 2.4, 0.03);
    const ribs: Transform[] = [];
    for (let i = 0; i < 15; i++) {
        for (const z of [half + 0.015, -half - 0.015]) {
            ribs.push({ x: -3.8 + i * 0.33, y: 2.1, z });
        }
    }
    body.add(instanced(rib, m.alloy, ribs));
    body.add(box(0.008, 2.3, 0.02, m.plastic, -3.96, 2.1, 0));
    for (const z of [0.6, -0.6]) {
        body.add(box(0.03, 0.8, 0.05, m.chrome, -3.97, 1.9, z));
        body.add(taillight(m, 0.35, 0.16, -3.98, 0.95, z * 1.5));
    }
    body.add(box(0.1, 0.1, 2.2, m.steel, -4.05, 0.72, 0));
    body.add(plate(m, -4.02, 0.55, -1));

    for (const x of [2.9]) {
        body.add(
            wheel(m, R, 0.32, x, half - 0.2, {
                steel: true,
                spokes: 8,
                offroad: true,
            }),
        );
        body.add(
            wheel(m, R, 0.32, x, -half + 0.2, {
                steel: true,
                spokes: 8,
                offroad: true,
            }),
        );
    }
    for (const x of [-1.6, -2.9]) {
        body.add(
            wheel(m, R, 0.32, x, half - 0.2, {
                steel: true,
                spokes: 8,
                dual: true,
                offroad: true,
            }),
        );
        body.add(
            wheel(m, R, 0.32, x, -half + 0.2, {
                steel: true,
                spokes: 8,
                dual: true,
                offroad: true,
            }),
        );
        body.add(cyl(0.07, width - 0.5, m.iron, 'z', x, R, 0));
        for (const z of [half - 0.15, -half + 0.15]) {
            body.add(
                arch(
                    m,
                    R + 0.1,
                    0.05,
                    x,
                    R,
                    z * 1.05,
                    m.plastic,
                    Math.PI * 0.85,
                ),
            );
        }
    }
    body.add(cyl(0.07, width - 0.5, m.iron, 'z', 2.9, R, 0));
    body.add(box(2.2, 0.12, 0.3, m.iron, -2.25, R + 0.1, 0.45));
    body.add(box(2.2, 0.12, 0.3, m.iron, -2.25, R + 0.1, -0.45));

    return { position: new THREE.Vector3(2.65, 1.0, 0), scale: 0.95 };
}

function buildBus(m: Materials, body: THREE.Group): EngineAnchor {
    const width = 2.5;
    const half = width / 2;
    const R = 0.5;
    const floor = 0.42;

    body.add(
        extrude(
            silhouette(
                [
                    [5.5, floor],
                    [5.58, 1.0],
                    [5.5, 1.5],
                    [5.38, 2.95],
                    [5.2, 3.2],
                    [-5.3, 3.22],
                    [-5.5, 3.0],
                    [-5.55, 1.2],
                    [-5.5, floor],
                ],
                [
                    { x: 3.4, radius: 0.6 },
                    { x: -2.9, radius: 0.6 },
                ],
                floor,
            ),
            width,
            m.paint,
            { bevel: 0.06 },
        ),
    );

    // Windscreen, window band with frames, door, rear window.
    body.add(strut([5.5, 1.55], [5.38, 2.92], 0.025, width * 0.88, m.glass, 0));
    body.add(box(0.03, 0.4, 2.0, m.plastic, 5.42, 3.0, 0));
    for (const z of [half + 0.005, -half - 0.005]) {
        body.add(box(9.3, 1.15, 0.02, m.glass, -0.55, 2.3, z, 0.02));
        body.add(box(9.3, 0.03, 0.03, m.plastic, -0.55, 2.88, z * 1.01));
        body.add(box(9.3, 0.03, 0.03, m.plastic, -0.55, 1.72, z * 1.01));
        for (let i = 0; i <= 7; i++) {
            body.add(
                box(0.03, 1.15, 0.03, m.plastic, 4.1 - i * 1.33, 2.3, z * 1.01),
            );
        }
        body.add(box(4.0, 0.14, 0.02, m.plastic, -3.2, 1.45, z * 1.01));
    }
    body.add(box(1.0, 1.9, 0.02, m.glass, 4.4, 1.55, half + 0.006));
    body.add(box(0.03, 1.9, 0.03, m.plastic, 3.9, 1.55, half * 1.01));
    body.add(box(0.03, 1.9, 0.03, m.plastic, 4.9, 1.55, half * 1.01));
    body.add(box(0.02, 1.2, width * 0.8, m.glass, -5.56, 2.3, 0));
    body.add(box(0.8, 0.35, 1.8, m.paintDark, -0.5, 3.35, 0, 0.06));
    body.add(box(1.6, 0.4, 1.6, m.paintDark, 2.5, 3.38, 0, 0.06));

    body.add(box(0.2, 0.4, width, m.paintDark, 5.5, 0.62, 0, 0.06));
    body.add(box(0.2, 0.4, width, m.paintDark, -5.5, 0.62, 0, 0.06));
    for (const z of [0.8, -0.8]) {
        body.add(headlight(m, 0.5, 0.22, 5.6, 1.05, z));
        body.add(taillight(m, 0.25, 0.5, -5.57, 1.4, z * 1.35));
    }
    body.add(grille(m, 1.4, 0.3, 5.58, 1.32, 0, 4));
    body.add(plate(m, 5.65, 0.7));
    body.add(plate(m, -5.62, 0.8, -1));
    for (const z of [half + 0.2, -half - 0.2]) {
        body.add(box(0.06, 0.9, 0.05, m.plastic, 5.3, 2.5, z));
        body.add(box(0.1, 0.5, 0.25, m.paintDark, 5.35, 2.75, z, 0.03));
    }

    interior(m, body, 0, 1.72, 3.15, 9.5, width - 0.3, 6);
    body.add(box(9.2, 0.06, width - 0.4, m.plastic, -0.2, floor - 0.02, 0));

    for (const x of [3.4, -2.9]) {
        body.add(
            wheel(m, R, 0.32, x, half - 0.22, {
                steel: true,
                spokes: 8,
                dual: x < 0,
            }),
        );
        body.add(
            wheel(m, R, 0.32, x, -half + 0.22, {
                steel: true,
                spokes: 8,
                dual: x < 0,
            }),
        );
        body.add(
            cyl(R + 0.08, width - 0.6, m.plastic, 'z', x, R, 0, {
                segments: 24,
            }),
        );
    }

    return {
        position: new THREE.Vector3(-4.3, 0.9, 0),
        scale: 0.85,
        rotationY: Math.PI,
    };
}

/* ------------------------------------------------------------------------ */
/* Motorcycle and ATV                                                        */
/* ------------------------------------------------------------------------ */

function buildMotorcycle(m: Materials, body: THREE.Group): EngineAnchor {
    const R = 0.32;
    const frontX = 0.74;
    const rearX = -0.7;

    body.add(wheel(m, R, 0.13, frontX, 0, { open: true, spokes: 12 }));
    body.add(wheel(m, R + 0.01, 0.17, rearX, 0, { open: true, spokes: 12 }));

    // Frame.
    const head: Point3 = [0.42, 0.88, 0];
    body.add(tube([head, [0.1, 0.85, 0], [-0.3, 0.72, 0]], 0.025, m.plastic));
    for (const z of [0.07, -0.07]) {
        body.add(
            tube(
                [
                    head,
                    [0.32, 0.55, z],
                    [0.25, 0.32, z],
                    [-0.35, 0.3, z],
                    [-0.38, 0.5, z],
                    [-0.3, 0.72, z],
                ],
                0.018,
                m.plastic,
            ),
        );
        body.add(
            tube(
                [
                    [-0.3, 0.72, z],
                    [-0.7, 0.7, z * 1.4],
                    [-0.95, 0.66, z * 1.4],
                ],
                0.016,
                m.plastic,
            ),
        );
        body.add(
            tube(
                [
                    [-0.38, 0.5, z],
                    [-0.95, 0.66, z * 1.4],
                ],
                0.014,
                m.plastic,
            ),
        );
        // Swingarm and shock.
        body.add(
            strut(
                [-0.36, 0.42],
                [rearX, R],
                0.05,
                0.03,
                m.steel,
                z * 1.5,
                0.01,
            ),
        );
        body.add(
            strut([-0.8, 0.66], [-0.62, 0.38], 0.03, 0.03, m.chrome, z * 2.2),
        );
        body.add(
            strut([-0.8, 0.66], [-0.71, 0.52], 0.05, 0.05, m.plastic, z * 2.2),
        );
    }
    body.add(cyl(0.06, 0.2, m.steel, 'z', 0.42, 0.88, 0));

    // Forks and handlebars.
    for (const z of [0.09, -0.09]) {
        body.add(strut([0.5, 0.98], [frontX, R], 0.032, 0.032, m.chrome, z));
        body.add(
            strut([frontX - 0.1, 0.6], [frontX, R], 0.045, 0.045, m.plastic, z),
        );
        body.add(
            strut([frontX - 0.08, 0.66], [frontX, R], 0.03, 0.03, m.rubber, z),
        );
    }
    body.add(box(0.12, 0.03, 0.26, m.steel, 0.47, 1.0, 0, 0.01));
    body.add(box(0.12, 0.03, 0.26, m.steel, 0.43, 0.8, 0, 0.01));
    body.add(
        tube(
            [
                [0.35, 1.06, 0.36],
                [0.4, 1.08, 0.2],
                [0.45, 1.05, 0],
                [0.4, 1.08, -0.2],
                [0.35, 1.06, -0.36],
            ],
            0.014,
            m.chrome,
        ),
    );
    body.add(cyl(0.018, 0.12, m.rubber, 'z', 0.35, 1.06, 0.4));
    body.add(cyl(0.018, 0.12, m.rubber, 'z', 0.35, 1.06, -0.4));
    for (const z of [0.3, -0.3]) {
        body.add(strut([0.33, 1.08], [0.2, 1.2], 0.01, 0.01, m.plastic, z));
        body.add(box(0.03, 0.06, 0.09, m.paintDark, 0.2, 1.22, z, 0.01));
        body.add(
            strut([0.35, 1.06], [0.5, 1.02], 0.008, 0.008, m.chrome, z * 1.2),
        );
    }

    // Headlight, instruments, tank, seat, tail, fenders.
    body.add(cyl(0.1, 0.1, m.chrome, 'x', 0.5, 0.9, 0));
    body.add(cyl(0.09, 0.02, m.lens, 'x', 0.56, 0.9, 0));
    body.add(cyl(0.05, 0.03, m.plastic, 'y', 0.4, 1.08, 0));
    body.add(sphere(0.3, m.paint, 0.05, 0.86, 0, [1.1, 0.5, 0.62]));
    body.add(cyl(0.03, 0.01, m.chrome, 'y', 0.02, 1.02, 0));
    body.add(box(0.6, 0.09, 0.28, m.fabric, -0.45, 0.8, 0, 0.03));
    body.add(box(0.32, 0.12, 0.22, m.paint, -0.85, 0.78, 0, 0.04));
    body.add(taillight(m, 0.12, 0.05, -1.02, 0.78, 0));
    body.add(arch(m, R + 0.05, 0.02, frontX, R, 0, m.paint, Math.PI * 0.8));
    body.add(box(0.28, 0.008, 0.16, m.paint, frontX, R * 2 + 0.05, 0));
    body.add(arch(m, R + 0.07, 0.02, rearX, R, 0, m.paint, Math.PI * 0.6));

    // Chain, sprockets, exhaust, pegs, stand, mirrors.
    body.add(cyl(0.05, 0.015, m.steel, 'z', -0.36, 0.42, 0.13));
    body.add(cyl(0.11, 0.015, m.steel, 'z', rearX, R, 0.13));
    body.add(
        tube(
            [
                [-0.36, 0.47, 0.13],
                [rearX, R + 0.11, 0.13],
                [rearX - 0.11, R, 0.13],
                [rearX, R - 0.11, 0.13],
                [-0.36, 0.37, 0.13],
            ],
            0.008,
            m.plastic,
            { closed: true, segments: 48 },
        ),
    );
    body.add(
        tube(
            [
                [0.05, 0.55, -0.12],
                [0.25, 0.32, -0.16],
                [-0.2, 0.28, -0.2],
                [-0.55, 0.36, -0.22],
            ],
            0.024,
            m.heat,
        ),
    );
    body.add(cyl(0.05, 0.42, m.chrome, 'x', -0.72, 0.4, -0.22, { top: 0.04 }));
    for (const z of [0.16, -0.16]) {
        body.add(cyl(0.012, 0.1, m.rubber, 'z', -0.25, 0.3, z * 1.4));
        body.add(cyl(0.012, 0.1, m.rubber, 'z', -0.6, 0.36, z * 1.6));
    }
    body.add(strut([-0.3, 0.3], [-0.2, 0.03], 0.015, 0.015, m.plastic, 0.12));

    return {
        position: new THREE.Vector3(-0.05, 0.52, 0),
        scale: 0.3,
        rotationY: Math.PI / 2,
        exposed: true,
    };
}

function buildAtv(m: Materials, body: THREE.Group): EngineAnchor {
    const R = 0.31;
    const track = 0.52;
    const wheels = [0.62, -0.62];

    for (const x of wheels) {
        body.add(
            wheel(m, R, 0.26, x, track, {
                offroad: true,
                steel: true,
                spokes: 6,
            }),
        );
        body.add(
            wheel(m, R, 0.26, x, -track, {
                offroad: true,
                steel: true,
                spokes: 6,
            }),
        );
        body.add(cyl(0.03, track * 2 - 0.3, m.steel, 'z', x, R, 0));
        for (const z of [0.25, -0.25]) {
            body.add(
                strut(
                    [x, R],
                    [x > 0 ? 0.25 : -0.25, 0.4],
                    0.03,
                    0.03,
                    m.steel,
                    z * 1.4,
                ),
            );
        }
    }

    // Frame and floorboards.
    for (const z of [0.2, -0.2]) {
        body.add(
            tube(
                [
                    [0.75, 0.42, z],
                    [0.6, 0.3, z],
                    [-0.6, 0.3, z],
                    [-0.8, 0.45, z],
                ],
                0.02,
                m.plastic,
            ),
        );
        body.add(
            tube(
                [
                    [0.3, 0.3, z],
                    [0.35, 0.75, z * 0.8],
                    [-0.35, 0.78, z * 0.8],
                    [-0.4, 0.3, z],
                ],
                0.018,
                m.plastic,
            ),
        );
    }
    for (const z of [0.4, -0.4]) {
        body.add(box(0.7, 0.03, 0.22, m.plastic, 0, 0.32, z, 0.01));
    }
    body.add(box(1.1, 0.06, 0.5, m.iron, 0, 0.26, 0));

    // Plastics, seat, tank, racks.
    body.add(box(0.75, 0.22, 1.05, m.paintDark, 0.7, 0.62, 0, 0.06));
    body.add(box(0.5, 0.18, 1.1, m.paintDark, -0.65, 0.62, 0, 0.06));
    body.add(box(0.6, 0.28, 0.55, m.paintDark, 0.2, 0.68, 0, 0.06));
    body.add(sphere(0.2, m.paint, 0.15, 0.82, 0, [1.1, 0.5, 1]));
    body.add(cyl(0.03, 0.01, m.chrome, 'y', 0.15, 0.93, 0));
    body.add(box(0.7, 0.12, 0.42, m.fabric, -0.35, 0.86, 0, 0.04));
    for (const [x, len] of [
        [0.9, 0.5],
        [-0.85, 0.6],
    ] as Point[]) {
        for (const z of [0.42, -0.42]) {
            body.add(
                tube(
                    [
                        [x - len / 2, 0.8, z],
                        [x + len / 2, 0.8, z],
                    ],
                    0.012,
                    m.plastic,
                ),
            );
        }
        for (const dx of [-len / 2, 0, len / 2]) {
            body.add(
                tube(
                    [
                        [x + dx, 0.8, 0.42],
                        [x + dx, 0.8, -0.42],
                    ],
                    0.012,
                    m.plastic,
                ),
            );
        }
        for (const z of [0.4, -0.4]) {
            body.add(cyl(0.012, 0.12, m.plastic, 'y', x, 0.74, z));
        }
    }

    // Handlebars, headlights, bumper.
    body.add(
        tube(
            [
                [0.35, 0.7, 0],
                [0.42, 1.0, 0],
            ],
            0.03,
            m.plastic,
        ),
    );
    body.add(
        tube(
            [
                [0.32, 1.02, 0.36],
                [0.4, 1.05, 0.18],
                [0.44, 1.02, 0],
                [0.4, 1.05, -0.18],
                [0.32, 1.02, -0.36],
            ],
            0.014,
            m.chrome,
        ),
    );
    body.add(cyl(0.02, 0.12, m.rubber, 'z', 0.32, 1.02, 0.4));
    body.add(cyl(0.02, 0.12, m.rubber, 'z', 0.32, 1.02, -0.4));
    body.add(box(0.14, 0.12, 0.2, m.plastic, 0.44, 0.98, 0, 0.02));
    for (const z of [0.3, -0.3]) {
        body.add(headlight(m, 0.16, 0.1, 1.07, 0.66, z));
    }
    body.add(
        tube(
            [
                [0.95, 0.4, 0.45],
                [1.15, 0.45, 0.3],
                [1.15, 0.45, -0.3],
                [0.95, 0.4, -0.45],
            ],
            0.02,
            m.steel,
        ),
    );
    body.add(
        tube(
            [
                [1.0, 0.55, 0.3],
                [1.12, 0.6, 0],
                [1.0, 0.55, -0.3],
            ],
            0.016,
            m.steel,
        ),
    );
    body.add(box(0.6, 0.02, 0.6, m.steel, 0.05, 0.2, 0));
    body.add(
        tube(
            [
                [0.05, 0.45, 0.2],
                [-0.4, 0.35, 0.35],
                [-0.75, 0.42, 0.38],
            ],
            0.022,
            m.heat,
        ),
    );
    body.add(cyl(0.05, 0.3, m.steel, 'x', -0.95, 0.44, 0.38));

    return {
        position: new THREE.Vector3(0.1, 0.52, 0),
        scale: 0.28,
        exposed: true,
    };
}

/* ------------------------------------------------------------------------ */
/* Tractor and mower                                                         */
/* ------------------------------------------------------------------------ */

function buildTractor(m: Materials, body: THREE.Group): EngineAnchor {
    const rearR = 0.9;
    const frontR = 0.48;

    body.add(box(3.4, 0.4, 0.7, m.iron, 0.2, 0.78, 0, 0.02));
    body.add(cyl(0.08, 1.5, m.iron, 'z', 1.55, frontR, 0));
    body.add(cyl(0.12, 2.0, m.iron, 'z', -0.9, rearR, 0));
    body.add(box(0.5, 0.5, 0.7, m.iron, -0.9, rearR, 0, 0.05));

    // Bonnet, grille, stack.
    body.add(
        extrude(
            polygon([
                [2.35, 0.95],
                [2.38, 1.3],
                [2.3, 1.5],
                [1.0, 1.58],
                [0.95, 0.95],
            ]),
            0.95,
            m.paint,
            { bevel: 0.06 },
        ),
    );
    body.add(grille(m, 0.75, 0.5, 2.4, 1.22, 0, 6));
    for (const z of [0.28, -0.28]) {
        body.add(headlight(m, 0.16, 0.12, 2.4, 1.45, z));
    }
    const louvre = new THREE.BoxGeometry(0.4, 0.008, 0.03);
    const louvres: Transform[] = [];
    for (let i = 0; i < 6; i++) {
        louvres.push({ x: 1.6, y: 1.1 + i * 0.07, z: 0.49 });
        louvres.push({ x: 1.6, y: 1.1 + i * 0.07, z: -0.49 });
    }
    body.add(instanced(louvre, m.plastic, louvres));
    body.add(cyl(0.05, 1.35, m.steel, 'y', 1.6, 2.15, 0.28));
    body.add(cyl(0.07, 0.08, m.steel, 'y', 1.6, 2.85, 0.28, { top: 0.03 }));
    body.add(cyl(0.1, 0.25, m.plastic, 'y', 1.15, 1.75, -0.25));
    body.add(cyl(0.04, 0.35, m.plastic, 'y', 1.15, 1.5, -0.25));

    // Cab.
    const cabWidth = 1.25;
    body.add(box(1.9, 0.08, cabWidth, m.plastic, -0.35, 1.05, 0));
    body.add(
        extrude(
            polygon([
                [0.9, 1.08],
                [0.9, 2.45],
                [0.75, 2.6],
                [-1.4, 2.6],
                [-1.55, 2.45],
                [-1.55, 1.08],
            ]),
            cabWidth,
            m.glass,
            { bevel: 0.02 },
        ),
    );
    body.add(box(2.5, 0.08, cabWidth + 0.1, m.paint, -0.32, 2.64, 0, 0.03));
    for (const z of [cabWidth / 2 - 0.02, -cabWidth / 2 + 0.02]) {
        body.add(box(0.06, 1.5, 0.06, m.paintDark, 0.87, 1.83, z));
        body.add(box(0.06, 1.5, 0.06, m.paintDark, -0.45, 1.83, z));
        body.add(box(0.06, 1.5, 0.06, m.paintDark, -1.52, 1.83, z));
        body.add(box(0.008, 1.3, 0.02, m.plastic, -0.9, 1.75, z * 1.02));
        body.add(mirror(m, 0.3, 2.1, z * 1.35));
    }
    body.add(box(0.5, 0.12, 0.5, m.fabric, -0.6, 1.2, 0, 0.03));
    body.add(box(0.1, 0.5, 0.5, m.fabric, -0.85, 1.48, 0, 0.03));
    body.add(box(0.3, 0.2, 0.8, m.plastic, 0.55, 1.3, 0, 0.02));
    const column = tube(
        [
            [0.5, 1.35, 0],
            [0.25, 1.65, 0],
        ],
        0.02,
        m.plastic,
    );
    body.add(column);
    const steering = torus(0.18, 0.02, m.plastic, 'x', 0.22, 1.68, 0);
    steering.rotation.z = -0.9;
    body.add(steering);

    // Rear fenders, steps, weights, linkage.
    for (const z of [1.0, -1.0]) {
        body.add(
            arch(
                m,
                rearR + 0.1,
                0.14,
                -0.9,
                rearR,
                z * 1.02,
                m.paint,
                Math.PI * 0.75,
            ),
        );
        body.add(
            box(
                0.8,
                0.1,
                0.45,
                m.paint,
                -0.9,
                rearR * 2 + 0.05,
                z * 1.02,
                0.02,
            ),
        );
    }
    for (const y of [0.55, 0.85]) {
        body.add(box(0.35, 0.03, 0.2, m.steel, 0.75, y, 0.75));
    }
    body.add(box(0.3, 0.45, 0.6, m.iron, 2.55, 0.85, 0, 0.02));
    const weight = new THREE.BoxGeometry(0.06, 0.4, 0.5);
    body.add(
        instanced(
            weight,
            m.iron,
            [0, 1, 2, 3].map((i) => ({ x: 2.68 + i * 0.07, y: 0.85, z: 0 })),
        ),
    );
    for (const z of [0.35, -0.35]) {
        body.add(strut([-1.0, 0.7], [-1.9, 0.5], 0.06, 0.06, m.iron, z));
        body.add(strut([-1.7, 0.85], [-1.9, 0.62], 0.04, 0.04, m.steel, z));
    }
    body.add(strut([-1.05, 1.05], [-1.85, 0.95], 0.05, 0.05, m.iron, 0));
    body.add(cyl(0.035, 0.3, m.steel, 'x', -1.55, 0.72, 0));
    body.add(box(0.5, 0.06, 0.12, m.iron, -1.55, 0.55, 0));

    body.add(
        wheel(m, rearR, 0.55, -0.9, 1.0, {
            offroad: true,
            steel: true,
            spokes: 8,
            brake: false,
        }),
    );
    body.add(
        wheel(m, rearR, 0.55, -0.9, -1.0, {
            offroad: true,
            steel: true,
            spokes: 8,
            brake: false,
        }),
    );
    body.add(
        wheel(m, frontR, 0.3, 1.55, 0.75, {
            offroad: true,
            steel: true,
            spokes: 8,
            brake: false,
        }),
    );
    body.add(
        wheel(m, frontR, 0.3, 1.55, -0.75, {
            offroad: true,
            steel: true,
            spokes: 8,
            brake: false,
        }),
    );

    return { position: new THREE.Vector3(1.6, 1.2, 0), scale: 0.62 };
}

function buildMower(m: Materials, body: THREE.Group): EngineAnchor {
    const rearR = 0.28;
    const frontR = 0.18;

    // Deck with spindle covers, discharge chute and anti-scalp rollers.
    body.add(box(1.3, 0.12, 1.15, m.paintDark, 0.1, 0.16, 0, 0.05));
    for (const z of [0.3, -0.3]) {
        body.add(cyl(0.09, 0.06, m.paintDark, 'y', 0.1, 0.25, z));
        body.add(cyl(0.02, 0.06, m.steel, 'y', 0.1, 0.31, z));
    }
    const chute = box(0.45, 0.14, 0.32, m.paintDark, 0.05, 0.2, 0.72, 0.03);
    chute.rotation.x = -0.5;
    body.add(chute);
    for (const x of [0.7, -0.5]) {
        body.add(cyl(0.05, 0.12, m.plastic, 'z', x, 0.07, 0.35));
        body.add(cyl(0.05, 0.12, m.plastic, 'z', x, 0.07, -0.35));
    }
    body.add(box(1.5, 0.06, 0.5, m.iron, 0.1, 0.35, 0));
    for (const z of [0.42, -0.42]) {
        body.add(box(0.5, 0.02, 0.3, m.plastic, 0.35, 0.42, z));
    }

    // Hood, grille, dash, wheel, seat, fenders.
    body.add(box(0.85, 0.42, 0.7, m.paint, 0.7, 0.62, 0, 0.08));
    body.add(grille(m, 0.5, 0.2, 1.13, 0.6, 0, 4));
    for (const z of [0.22, -0.22]) {
        body.add(headlight(m, 0.12, 0.08, 1.13, 0.74, z));
    }
    body.add(box(0.008, 0.01, 0.6, m.plastic, 0.45, 0.83, 0));
    body.add(box(0.2, 0.28, 0.6, m.paintDark, 0.22, 0.6, 0, 0.03));
    body.add(
        tube(
            [
                [0.25, 0.7, 0],
                [0.32, 1.0, 0],
            ],
            0.02,
            m.plastic,
        ),
    );
    const steering = torus(0.16, 0.018, m.plastic, 'x', 0.33, 1.02, 0);
    steering.rotation.z = -1.1;
    body.add(steering);
    body.add(box(0.4, 0.1, 0.42, m.fabric, -0.35, 0.68, 0, 0.03));
    body.add(box(0.08, 0.42, 0.42, m.fabric, -0.58, 0.9, 0, 0.03));
    body.add(box(1.0, 0.1, 1.15, m.paint, -0.5, 0.58, 0, 0.04));
    body.add(box(0.06, 0.16, 0.4, m.plastic, -0.85, 0.48, 0.45));
    body.add(cyl(0.035, 0.03, m.plastic, 'y', -0.55, 0.65, 0.42));
    for (const z of [0.55, -0.55]) {
        body.add(box(0.1, 0.02, 0.08, m.plastic, 0.35, 0.36, z));
    }
    body.add(box(0.1, 0.02, 0.08, m.rubber, 0.55, 0.38, 0.35));

    body.add(
        wheel(m, rearR, 0.22, -0.55, 0.55, {
            offroad: true,
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(
        wheel(m, rearR, 0.22, -0.55, -0.55, {
            offroad: true,
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(
        wheel(m, frontR, 0.14, 0.82, 0.48, {
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(
        wheel(m, frontR, 0.14, 0.82, -0.48, {
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(cyl(0.025, 0.85, m.iron, 'z', 0.82, frontR, 0));

    return {
        position: new THREE.Vector3(0.7, 0.55, 0),
        scale: 0.26,
        rotationY: Math.PI / 2,
    };
}

/* ------------------------------------------------------------------------ */
/* Outboard, generator, trailer, generic                                     */
/* ------------------------------------------------------------------------ */

function buildOutboard(m: Materials, body: THREE.Group): EngineAnchor {
    body.add(
        extrude(
            polygon([
                [0.34, 1.45],
                [0.38, 1.75],
                [0.32, 2.05],
                [0.12, 2.16],
                [-0.3, 2.13],
                [-0.42, 1.9],
                [-0.4, 1.45],
            ]),
            0.52,
            m.paint,
            { bevel: 0.07 },
        ),
    );
    body.add(box(0.78, 0.1, 0.52, m.plastic, -0.02, 1.4, 0, 0.03));
    const vent = new THREE.BoxGeometry(0.14, 0.008, 0.02);
    body.add(
        instanced(
            vent,
            m.plastic,
            [0, 1, 2, 3, 4].map((i) => ({
                x: -0.35,
                y: 1.6 + i * 0.05,
                z: 0.27,
            })),
        ),
    );
    body.add(
        instanced(
            vent,
            m.plastic,
            [0, 1, 2, 3, 4].map((i) => ({
                x: -0.35,
                y: 1.6 + i * 0.05,
                z: -0.27,
            })),
        ),
    );
    body.add(box(0.008, 0.01, 0.45, m.plastic, 0.2, 2.1, 0));

    // Midsection, plate, gearcase, skeg, prop.
    body.add(box(0.3, 0.8, 0.24, m.paint, -0.02, 0.98, 0, 0.05));
    body.add(box(0.45, 0.02, 0.32, m.paint, -0.04, 0.62, 0));
    body.add(box(0.2, 0.02, 0.22, m.plastic, 0.12, 0.6, 0));
    body.add(box(0.04, 0.03, 0.26, m.steel, -0.25, 0.58, 0));
    body.add(box(0.05, 0.2, 0.05, m.plastic, -0.15, 0.85, 0.13));
    const gearcase = new THREE.Mesh(
        new THREE.LatheGeometry(
            [
                new THREE.Vector2(0, -0.34),
                new THREE.Vector2(0.06, -0.3),
                new THREE.Vector2(0.1, -0.15),
                new THREE.Vector2(0.11, 0.1),
                new THREE.Vector2(0.09, 0.28),
                new THREE.Vector2(0.05, 0.34),
                new THREE.Vector2(0, 0.36),
            ],
            32,
        ),
        m.paint,
    );
    gearcase.rotation.z = Math.PI / 2;
    gearcase.position.set(0.02, 0.3, 0);
    gearcase.castShadow = true;
    body.add(gearcase);
    const slot = new THREE.BoxGeometry(0.03, 0.006, 0.02);
    body.add(
        instanced(
            slot,
            m.plastic,
            [0, 1, 2, 3].map((i) => ({ x: 0.05 + i * 0.045, y: 0.3, z: 0.1 })),
        ),
    );
    const skeg = box(0.28, 0.2, 0.025, m.paint, -0.04, 0.12, 0, 0.005);
    skeg.rotation.z = 0.15;
    body.add(skeg);
    body.add(cyl(0.045, 0.16, m.steel, 'x', -0.36, 0.3, 0, { top: 0.03 }));
    for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        const blade = sphere(0.1, m.steel, -0.34, 0.3, 0, [0.25, 1.4, 0.7]);
        blade.position.y = 0.3 + Math.cos(angle) * 0.09;
        blade.position.z = Math.sin(angle) * 0.09;
        blade.rotation.x = angle;
        blade.rotation.y = 0.5;
        body.add(blade);
    }

    // Transom bracket, clamps, tilt tube, tiller.
    for (const z of [0.16, -0.16]) {
        body.add(box(0.28, 0.5, 0.04, m.steel, 0.18, 1.05, z, 0.01));
        body.add(cyl(0.02, 0.2, m.steel, 'x', 0.34, 0.88, z));
        body.add(cyl(0.035, 0.04, m.plastic, 'x', 0.46, 0.88, z));
    }
    body.add(cyl(0.03, 0.42, m.steel, 'z', 0.15, 1.28, 0));
    body.add(box(0.12, 0.08, 0.14, m.plastic, 0.24, 1.18, 0, 0.02));
    body.add(
        tube(
            [
                [0.2, 1.62, 0],
                [0.55, 1.45, 0.05],
                [0.85, 1.32, 0.08],
            ],
            0.025,
            m.plastic,
        ),
    );
    body.add(cyl(0.03, 0.14, m.rubber, 'x', 0.88, 1.3, 0.08));

    return {
        position: new THREE.Vector3(-0.02, 1.7, 0),
        scale: 0.28,
        rotationY: Math.PI / 2,
    };
}

function buildGenerator(m: Materials, body: THREE.Group): EngineAnchor {
    const L = 1.25;
    const W = 0.72;
    const H = 0.88;

    // Tube frame with gussets and feet.
    for (const [y, z] of [
        [0.1, W / 2],
        [0.1, -W / 2],
        [H, W / 2],
        [H, -W / 2],
    ] as Point[]) {
        body.add(
            tube(
                [
                    [-L / 2, y, z],
                    [L / 2, y, z],
                ],
                0.022,
                m.plastic,
                { segments: 4 },
            ),
        );
    }
    for (const x of [L / 2, -L / 2]) {
        for (const z of [W / 2, -W / 2]) {
            body.add(
                tube(
                    [
                        [x, 0.1, z],
                        [x, H, z],
                    ],
                    0.022,
                    m.plastic,
                    { segments: 4 },
                ),
            );
            body.add(cyl(0.035, 0.05, m.rubber, 'y', x, 0.05, z));
        }
        body.add(
            tube(
                [
                    [x, 0.1, W / 2],
                    [x, 0.1, -W / 2],
                ],
                0.022,
                m.plastic,
                { segments: 4 },
            ),
        );
        body.add(
            tube(
                [
                    [x, H, W / 2],
                    [x, H, -W / 2],
                ],
                0.022,
                m.plastic,
                { segments: 4 },
            ),
        );
    }
    body.add(box(L - 0.1, 0.05, W - 0.08, m.iron, 0, 0.15, 0));
    for (const z of [0.2, -0.2]) {
        body.add(cyl(0.03, 0.05, m.rubber, 'y', 0.15, 0.2, z));
        body.add(cyl(0.03, 0.05, m.rubber, 'y', -0.15, 0.2, z));
    }

    // Alternator, control panel, fuel tank, muffler, wheels and handle.
    body.add(cyl(0.17, 0.34, m.steel, 'x', -0.36, 0.42, 0));
    body.add(cyl(0.13, 0.06, m.plastic, 'x', -0.56, 0.42, 0));
    const slot = new THREE.BoxGeometry(0.012, 0.09, 0.03);
    const slots: Transform[] = [];
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        slots.push({
            x: -0.5,
            y: 0.42 + Math.cos(angle) * 0.14,
            z: Math.sin(angle) * 0.14,
            rx: -angle,
        });
    }
    body.add(instanced(slot, m.plastic, slots));
    body.add(box(0.08, 0.32, 0.5, m.plastic, -L / 2 + 0.02, 0.5, 0, 0.02));
    for (const z of [0.12, -0.12]) {
        body.add(
            box(0.02, 0.07, 0.07, m.plastic, -L / 2 - 0.03, 0.42, z, 0.01),
        );
        body.add(cyl(0.012, 0.02, m.plate, 'x', -L / 2 - 0.04, 0.42, z));
    }
    body.add(cyl(0.05, 0.02, m.plate, 'x', -L / 2 - 0.03, 0.58, 0));
    body.add(box(0.05, 0.05, 0.03, m.plastic, -L / 2 - 0.03, 0.34, 0.2));
    body.add(box(L - 0.35, 0.2, W - 0.14, m.paint, 0.05, H + 0.06, 0, 0.05));
    body.add(cyl(0.05, 0.05, m.plastic, 'y', 0.1, H + 0.18, 0.12));
    body.add(cyl(0.03, 0.01, m.plate, 'y', -0.15, H + 0.165, -0.12));
    body.add(cyl(0.075, 0.34, m.steel, 'x', 0.05, 0.62, W / 2 - 0.1));
    body.add(box(0.36, 0.1, 0.02, m.plastic, 0.05, 0.7, W / 2 - 0.02));
    body.add(cyl(0.02, 0.08, m.heat, 'x', -0.16, 0.62, W / 2 - 0.1));
    body.add(
        wheel(m, 0.13, 0.08, -0.5, W / 2 + 0.08, {
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(
        wheel(m, 0.13, 0.08, -0.5, -W / 2 - 0.08, {
            steel: true,
            spokes: 6,
            brake: false,
        }),
    );
    body.add(cyl(0.015, W + 0.3, m.steel, 'z', -0.5, 0.13, 0));
    body.add(
        tube(
            [
                [L / 2, 0.75, W / 2],
                [L / 2 + 0.35, 0.95, W / 2],
                [L / 2 + 0.35, 0.95, -W / 2],
                [L / 2, 0.75, -W / 2],
            ],
            0.02,
            m.plastic,
        ),
    );
    body.add(cyl(0.03, 0.4, m.rubber, 'z', L / 2 + 0.35, 0.95, 0));
    body.add(box(0.2, 0.2, 0.25, m.plastic, 0.42, 0.28, -0.2, 0.02));

    return {
        position: new THREE.Vector3(0.05, 0.45, 0),
        scale: 0.26,
        rotationY: Math.PI / 2,
        exposed: true,
    };
}

function buildTrailer(m: Materials, body: THREE.Group): EngineAnchor {
    const L = 3.2;
    const W = 1.8;
    const half = W / 2;
    const deck = 0.55;

    // Chassis, floor and cage sides.
    for (const z of [half, -half]) {
        body.add(box(L, 0.1, 0.06, m.iron, 0, deck - 0.05, z));
    }
    for (let i = 0; i <= 5; i++) {
        body.add(
            box(0.06, 0.08, W, m.iron, -L / 2 + (L / 5) * i, deck - 0.05, 0),
        );
    }
    body.add(box(L - 0.02, 0.02, W - 0.04, m.plastic, 0, deck, 0));
    const line = new THREE.BoxGeometry(0.008, 0.004, W - 0.08);
    body.add(
        instanced(
            line,
            m.steel,
            Array.from({ length: 24 }, (_, i) => ({
                x: -L / 2 + 0.1 + i * 0.13,
                y: deck + 0.012,
                z: 0,
            })),
        ),
    );
    for (const z of [half, -half]) {
        body.add(box(L, 0.03, 0.03, m.steel, 0, deck + 0.42, z));
        for (let i = 0; i <= 4; i++) {
            body.add(
                box(
                    0.03,
                    0.42,
                    0.03,
                    m.steel,
                    -L / 2 + (L / 4) * i,
                    deck + 0.21,
                    z,
                ),
            );
        }
        const mesh = new THREE.BoxGeometry(0.006, 0.42, 0.006);
        body.add(
            instanced(
                mesh,
                m.steel,
                Array.from({ length: 30 }, (_, i) => ({
                    x: -L / 2 + 0.05 + i * 0.107,
                    y: deck + 0.21,
                    z,
                })),
            ),
        );
    }
    body.add(box(0.03, 0.42, W, m.steel, -L / 2, deck + 0.21, 0));
    body.add(box(0.03, 0.03, W, m.steel, -L / 2, deck + 0.42, 0));
    body.add(box(0.03, 0.42, W, m.steel, L / 2, deck + 0.21, 0));
    body.add(box(0.03, 0.03, W, m.steel, L / 2, deck + 0.42, 0));

    // Drawbar, coupling, jockey wheel, chains.
    for (const side of [1, -1]) {
        const arm = box(
            1.45,
            0.08,
            0.06,
            m.iron,
            L / 2 + 0.68,
            deck - 0.05,
            side * 0.4,
            0.01,
        );
        arm.rotation.y = side * 0.28;
        body.add(arm);
    }
    body.add(box(0.5, 0.08, 0.9, m.iron, L / 2 + 1.05, deck - 0.05, 0));
    body.add(box(0.22, 0.12, 0.1, m.steel, L / 2 + 1.4, deck - 0.02, 0, 0.02));
    body.add(box(0.08, 0.06, 0.12, m.steel, L / 2 + 1.5, deck + 0.02, 0));
    body.add(cyl(0.03, 0.5, m.steel, 'y', L / 2 + 0.7, deck - 0.2, 0.25));
    body.add(cyl(0.02, 0.35, m.chrome, 'y', L / 2 + 0.7, deck - 0.1, 0.25));
    body.add(
        wheel(m, 0.1, 0.06, L / 2 + 0.7, 0.25, {
            steel: true,
            spokes: 4,
            brake: false,
        }),
    );
    body.add(
        tube(
            [
                [L / 2 + 1.0, deck - 0.1, 0.1],
                [L / 2 + 1.25, deck - 0.25, 0.15],
                [L / 2 + 1.55, deck - 0.12, 0.08],
            ],
            0.012,
            m.steel,
        ),
    );

    // Axle, springs, wheels, guards, lights.
    const axleX = -0.3;
    body.add(cyl(0.04, W - 0.3, m.iron, 'z', axleX, 0.32, 0));
    for (const z of [half - 0.2, -half + 0.2]) {
        body.add(box(0.9, 0.04, 0.06, m.iron, axleX, 0.42, z));
        body.add(box(0.6, 0.03, 0.06, m.iron, axleX, 0.46, z));
        body.add(
            arch(
                m,
                0.38,
                0.08,
                axleX,
                0.32,
                z * 1.16,
                m.paintDark,
                Math.PI * 0.9,
            ),
        );
    }
    body.add(
        wheel(m, 0.32, 0.18, axleX, half + 0.1, {
            spokes: 5,
            brake: false,
            steel: true,
        }),
    );
    body.add(
        wheel(m, 0.32, 0.18, axleX, -half - 0.1, {
            spokes: 5,
            brake: false,
            steel: true,
        }),
    );
    for (const z of [half - 0.15, -half + 0.15]) {
        body.add(taillight(m, 0.2, 0.1, -L / 2 - 0.02, deck - 0.12, z));
    }
    body.add(plate(m, -L / 2 - 0.02, deck - 0.3, -1));

    return { position: new THREE.Vector3(0, deck, 0), scale: 0 };
}

function buildGeneric(m: Materials, body: THREE.Group): EngineAnchor {
    const R = 0.34;

    body.add(box(2.6, 0.5, 1.3, m.paintDark, 0, 0.62, 0, 0.05));
    body.add(box(1.1, 0.6, 1.25, m.paint, -0.65, 1.15, 0, 0.06));
    const louvre = new THREE.BoxGeometry(0.9, 0.008, 0.03);
    body.add(
        instanced(
            louvre,
            m.plastic,
            Array.from({ length: 7 }, (_, i) => ({
                x: -0.65,
                y: 0.95 + i * 0.06,
                z: 0.63,
            })),
        ),
    );
    body.add(
        instanced(
            louvre,
            m.plastic,
            Array.from({ length: 7 }, (_, i) => ({
                x: -0.65,
                y: 0.95 + i * 0.06,
                z: -0.63,
            })),
        ),
    );
    body.add(box(0.5, 0.1, 0.45, m.fabric, 0.35, 0.95, 0, 0.03));
    body.add(box(0.08, 0.45, 0.45, m.fabric, 0.1, 1.2, 0, 0.03));
    body.add(
        tube(
            [
                [0.75, 0.9, 0],
                [0.9, 1.25, 0],
            ],
            0.02,
            m.plastic,
        ),
    );
    const steering = torus(0.16, 0.02, m.plastic, 'x', 0.92, 1.27, 0);
    steering.rotation.z = -1.0;
    body.add(steering);
    body.add(box(0.3, 0.25, 0.7, m.plastic, 0.95, 1.0, 0, 0.03));
    for (const z of [0.55, -0.55]) {
        body.add(
            tube(
                [
                    [0.7, 0.85, z],
                    [0.7, 1.9, z],
                    [-0.8, 1.9, z],
                    [-0.9, 0.85, z],
                ],
                0.03,
                m.plastic,
            ),
        );
    }
    body.add(
        tube(
            [
                [0.7, 1.9, 0.55],
                [0.7, 1.9, -0.55],
            ],
            0.03,
            m.plastic,
            { segments: 4 },
        ),
    );
    body.add(
        tube(
            [
                [-0.8, 1.9, 0.55],
                [-0.8, 1.9, -0.55],
            ],
            0.03,
            m.plastic,
            { segments: 4 },
        ),
    );
    body.add(box(1.6, 0.03, 1.15, m.paintDark, -0.05, 1.93, 0, 0.01));
    for (const z of [0.4, -0.4]) {
        body.add(headlight(m, 0.2, 0.12, 1.31, 0.72, z));
    }
    body.add(box(0.1, 0.3, 1.2, m.steel, 1.35, 0.5, 0, 0.02));
    for (const x of [0.85, -0.85]) {
        body.add(
            wheel(m, R, 0.26, x, 0.75, {
                offroad: true,
                steel: true,
                spokes: 8,
                brake: false,
            }),
        );
        body.add(
            wheel(m, R, 0.26, x, -0.75, {
                offroad: true,
                steel: true,
                spokes: 8,
                brake: false,
            }),
        );
        body.add(cyl(0.05, 1.3, m.iron, 'z', x, R, 0));
    }

    return { position: new THREE.Vector3(-0.65, 0.95, 0), scale: 0.42 };
}
