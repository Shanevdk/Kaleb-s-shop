import * as THREE from 'three';
import {
    buildBodyShell,
    CHANNEL,
    type BodyDesign,
    type BodyShell,
} from '@/lib/three/body-shell';
import {
    clamp01,
    lerp,
    polygonDistance,
    roundedBoxDistance,
} from '@/lib/three/curves';
import type { Materials } from '@/lib/three/materials';
import { clonePatched } from '@/lib/three/shading';
import {
    bentTube,
    box,
    cyl,
    lathe,
    place,
    puck,
    rod,
    torus,
    tube,
    type Point,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import {
    boundaries,
    clipSurface,
    contours,
    raycastSurface,
    surfaceGeometries,
    type Polyline,
    type Surface,
    type SurfacePoint,
} from '@/lib/three/surface';
import { PROFILES, smoothPolyline, sweepAlong } from '@/lib/three/sweep';
import { plateTexture } from '@/lib/three/textures';
import { buildWheel, tyreRadius, type WheelSpec } from '@/lib/three/wheels';

/**
 * Where the engine sits, the room it has, and which way its crank runs.
 */
export type EngineBay = {
    position: THREE.Vector3;
    /** Room along the crank, up, and across it, in metres. */
    room: THREE.Vector3;
    /** 0 runs the crank front to back, π/2 across the vehicle. */
    rotationY: number;
    /** True when the engine is out in the open rather than under a cover. */
    exposed?: boolean;
    /** The machine leans on its stand by this much, about the x axis. */
    lean?: number;
    /** The crank stands upright, as on a mower or an outboard. */
    vertical?: boolean;
    /** What sort of engine lives here. */
    style?: 'car' | 'bike' | 'small' | 'outboard';
    /**
     * Where the machine's own exhaust picks up the engine's headers, in
     * the engine's coordinates.
     */
    exhaust?: THREE.Vector3;
};

/**
 * Everything that turns a body design into a particular vehicle: its
 * wheels, where the glass stops and starts, the shape of its lamps and
 * grille, where the doors split, and where the engine goes.
 */
export type RoadSpec = {
    design: BodyDesign;
    axles: [number, number];
    /** Wheel centre distance from the centreline. */
    track: number;
    wheels: WheelSpec;
    archRadius: number;
    /** Chunky black plastic arches and sills, as on an SUV or ute. */
    cladding?: boolean;
    glass: {
        /** The rear edge of the side glass at its foot and head. */
        rear: [number, number];
        /** Blacked-out pillars between panes, front and rear x. */
        pillars?: [number, number][];
        /** Glass behind this is privacy tinted. */
        privacyFrom?: number;
    };
    /** Vertical shut lines as x at the sill and x at the belt. */
    doorLines: [number, number][];
    handles: number[];
    mirror: number;
    /** Front view outlines as [|z|, y]. */
    headlamp: Point[];
    grille: Point[];
    intake?: Point[];
    fog?: [number, number, number];
    /** Rear view outline as [|z|, y]. */
    taillamp: Point[];
    /** Tailgate glass on the back face, as a rear view outline. */
    tailgateGlass?: Point[];
    plate: { front: number; rear: number };
    /** Rails along the roof, from and to x, and their offset from centre. */
    roofRails?: [number, number, number];
    /** Big mirrors for vans and utes. */
    mirrorScale?: number;
    /**
     * Heavy vehicle mirrors: out on arms from the door of a truck, or hung
     * forward of a bus's windscreen.
     */
    mirrorStyle?: 'truck' | 'bus';
    /** Arch liners; off when the wheels are not under this shell. */
    liners?: boolean;
    /** Only fit wheels on these axles; the builder adds the rest itself. */
    wheelAxles?: number[];
    /** The bonnet's rear edge, and whether there is a boot lid. */
    bonnetRear: number;
    boot?: 'lid' | 'tailgate' | 'none';
    fuel?: [number, number];
    exhaust?: { y: number; z: number; twin?: boolean };
    seats: { rows: number[]; bench?: boolean };
    bay: EngineBay;
};

export type RoadOptions = {
    registration?: string | null;
    rightHandDrive?: boolean;
    levels?: number;
};

const SLOT = {
    paint: 0,
    glass: 1,
    privacy: 2,
    gloss: 3,
    plastic: 4,
    lens: 5,
    redLens: 6,
    cowl: 7,
} as const;

function girthOf(point: SurfacePoint): number {
    return point.attributes[CHANNEL.girth];
}

function capOf(point: SurfacePoint): number {
    return point.attributes[CHANNEL.cap];
}

/**
 * A region on the sides and top of the body: between two girth rows and
 * two stations. Returns a rough signed distance, negative inside.
 */
function band(
    fromGirth: number,
    toGirth: number,
    rearX: (g: number) => number,
    frontX: (g: number) => number,
) {
    return (point: SurfacePoint): number => {
        if (Math.abs(capOf(point)) > 0.35) {
            return 1;
        }

        const g = girthOf(point);
        const x = point.position.x;
        const dg = Math.max(fromGirth - g, g - toGirth) * 0.07;
        const dx = Math.max(rearX(g) - x, x - frontX(g));

        return Math.max(dg, dx);
    };
}

/**
 * A region drawn on the front or back face, as an outline in [|z|, y].
 */
function faceRegion(
    outline: Point[],
    end: 'front' | 'rear',
    reach: number,
    front: number,
    rear: number,
) {
    // Far from the outline's box the exact distance does not matter.
    const margin = 0.06;
    const zs = outline.map(([z]) => z);
    const ys = outline.map(([, y]) => y);
    const [z0, z1] = [Math.min(...zs) - margin, Math.max(...zs) + margin];
    const [y0, y1] = [Math.min(...ys) - margin, Math.max(...ys) + margin];

    return (point: SurfacePoint): number => {
        const x = point.position.x;
        const within = end === 'front' ? x > front - reach : x < rear + reach;
        const facing =
            end === 'front' ? point.normal.x > -0.25 : point.normal.x < 0.25;

        if (!within || !facing) {
            return 1;
        }

        const z = Math.abs(point.position.z);
        const y = point.position.y;

        if (z < z0 || z > z1 || y < y0 || y > y1) {
            return margin;
        }

        return polygonDistance(z, y, outline);
    };
}

function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    shadows = true,
): THREE.Mesh {
    const result = new THREE.Mesh(geometry, material);
    result.castShadow = shadows;
    result.receiveShadow = true;

    return result;
}

/**
 * Run a line the way round that puts its sweep's +x side towards a point,
 * so a lip curls into the opening it edges.
 */
function orientLine(line: Polyline, towards: THREE.Vector3): Polyline {
    const middle = Math.floor(line.points.length / 2);
    const point = line.points[middle];
    const tangent = line.points[Math.min(line.points.length - 1, middle + 1)]
        .clone()
        .sub(line.points[Math.max(0, middle - 1)]);
    const side = tangent.cross(line.normals[middle]);

    if (side.dot(towards.clone().sub(point)) >= 0) {
        return line;
    }

    return {
        points: [...line.points].reverse(),
        normals: [...line.normals].reverse(),
        closed: line.closed,
    };
}

/**
 * Hit the body from outside along a direction and return where it lands.
 */
function onBody(
    surface: Surface,
    from: THREE.Vector3,
    towards: THREE.Vector3,
): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
    return raycastSurface(surface, from, towards);
}

/**
 * The centre of a set of triangles by material slot.
 */
function slotCentre(
    surface: Surface,
    slot: number,
    side: 1 | -1,
): THREE.Vector3 | null {
    const T = surface.triangles;
    const P = surface.positions;
    const centre = new THREE.Vector3();
    let count = 0;

    for (let t = 0; t < T.length; t += 3) {
        if (surface.materials[t / 3] !== slot) {
            continue;
        }

        const z =
            (P[T[t] * 3 + 2] + P[T[t + 1] * 3 + 2] + P[T[t + 2] * 3 + 2]) / 3;

        if (Math.sign(z) !== side) {
            continue;
        }

        for (let i = 0; i < 3; i++) {
            centre.x += P[T[t + i] * 3];
            centre.y += P[T[t + i] * 3 + 1];
            centre.z += P[T[t + i] * 3 + 2];
            count += 1;
        }
    }

    return count > 0 ? centre.divideScalar(count) : null;
}

/**
 * Copy the triangles of some material slots, pushed along their normals,
 * as a separate geometry: lamp housings, the cabin lining.
 */
function offsetCopy(
    surface: Surface,
    slots: number[],
    offset: number,
    keep: (centre: THREE.Vector3) => boolean = () => true,
): THREE.BufferGeometry {
    const T = surface.triangles;
    const P = surface.positions;
    const N = surface.normals;
    const positions: number[] = [];
    const normals: number[] = [];
    const centre = new THREE.Vector3();

    for (let t = 0; t < T.length; t += 3) {
        if (!slots.includes(surface.materials[t / 3])) {
            continue;
        }

        centre.set(0, 0, 0);

        for (let i = 0; i < 3; i++) {
            const v = T[t + i] * 3;
            centre.x += P[v] / 3;
            centre.y += P[v + 1] / 3;
            centre.z += P[v + 2] / 3;
        }

        if (!keep(centre)) {
            continue;
        }

        for (let i = 0; i < 3; i++) {
            const v = T[t + i] * 3;
            positions.push(
                P[v] + N[v] * offset,
                P[v + 1] + N[v + 1] * offset,
                P[v + 2] + N[v + 2] * offset,
            );
            normals.push(N[v], N[v + 1], N[v + 2]);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(normals, 3),
    );

    return geometry;
}

/**
 * Build a road vehicle into the group and say where its engine goes.
 */
export function buildRoadVehicle(
    m: Materials,
    spec: RoadSpec,
    group: THREE.Group,
    options: RoadOptions = {},
): EngineBay {
    const design = spec.design;
    const shell: BodyShell = buildBodyShell(design, options.levels);
    const { lines } = shell;
    let surface = shell.surface;
    const wheelRadius = tyreRadius(spec.wheels.tyre);
    const archCentre = wheelRadius + 0.012;
    const body = new THREE.Group();
    group.add(body);

    // Wheel arches: cut clean circles out of the flanks.
    for (const axle of spec.axles) {
        surface = clipSurface(
            surface,
            (point) => {
                if (
                    Math.abs(point.normal.y) > 0.92 &&
                    point.position.y > archCentre + spec.archRadius
                ) {
                    return 1;
                }

                return (
                    Math.hypot(
                        point.position.x - axle,
                        point.position.y - archCentre,
                    ) - spec.archRadius
                );
            },
            (material, inside) => (inside ? -1 : material),
        );
    }

    const g = spec.glass;
    const glassRear = (girth: number) =>
        lerp(g.rear[0], g.rear[1], clamp01(girth - 6));

    // Side glass, then the black frame above it and the B-pillar.
    surface = clipSurface(
        surface,
        band(6.04, 6.96, glassRear, () => design.cowl - 0.01),
        (material, inside) =>
            inside
                ? g.privacyFrom !== undefined
                    ? SLOT.glass
                    : SLOT.glass
                : material,
    );

    if (g.privacyFrom !== undefined) {
        const from = g.privacyFrom;
        surface = clipSurface(
            surface,
            (point) => point.position.x - from,
            (material, inside) =>
                inside && material === SLOT.glass ? SLOT.privacy : material,
        );
    }

    surface = clipSurface(
        surface,
        band(
            6.96,
            7.28,
            (girth) => glassRear(girth) - 0.02,
            () => design.cowl - 0.01,
        ),
        (material, inside) => (inside ? SLOT.gloss : material),
    );

    for (const [front, rear] of g.pillars ?? []) {
        surface = clipSurface(
            surface,
            band(
                5.98,
                7.28,
                () => rear,
                () => front,
            ),
            (material, inside) => (inside ? SLOT.gloss : material),
        );
    }

    // Windscreen, rear glass, and the cowl panel below the screen.
    surface = clipSurface(
        surface,
        band(
            8.06,
            12,
            () => design.header + 0.035,
            () => design.cowl - 0.035,
        ),
        (material, inside) => (inside ? SLOT.glass : material),
    );
    if (spec.bonnetRear < design.front) {
        surface = clipSurface(
            surface,
            band(
                6.4,
                12,
                () => design.cowl - 0.035,
                () => spec.bonnetRear,
            ),
            (material, inside) =>
                inside && material === SLOT.paint ? SLOT.cowl : material,
        );
    }

    if (design.rearHeader - design.deck > 0.05) {
        surface = clipSurface(
            surface,
            band(
                8.06,
                12,
                () => design.deck + 0.035,
                () => design.rearHeader - 0.035,
            ),
            (material, inside) =>
                inside
                    ? g.privacyFrom !== undefined
                        ? SLOT.privacy
                        : SLOT.glass
                    : material,
        );
    }

    if (spec.tailgateGlass) {
        surface = clipSurface(
            surface,
            faceRegion(
                spec.tailgateGlass,
                'rear',
                0.5,
                design.front,
                design.rear,
            ),
            (material, inside) => (inside ? SLOT.privacy : material),
        );
    }

    // Lamps, grille and intakes on the ends.
    surface = clipSurface(
        surface,
        faceRegion(spec.headlamp, 'front', 0.55, design.front, design.rear),
        (material, inside) => (inside ? SLOT.lens : material),
    );
    if (spec.taillamp.length >= 3) {
        surface = clipSurface(
            surface,
            faceRegion(spec.taillamp, 'rear', 0.5, design.front, design.rear),
            (material, inside) => (inside ? SLOT.redLens : material),
        );
    }
    surface = clipSurface(
        surface,
        faceRegion(spec.grille, 'front', 0.3, design.front, design.rear),
        (material, inside) => (inside ? -1 : material),
    );

    if (spec.intake) {
        surface = clipSurface(
            surface,
            faceRegion(spec.intake, 'front', 0.3, design.front, design.rear),
            (material, inside) => (inside ? -1 : material),
        );
    }

    if (spec.fog) {
        const [z, y, r] = spec.fog;
        surface = clipSurface(
            surface,
            (point) =>
                point.position.x < design.front - 0.35
                    ? 1
                    : roundedBoxDistance(
                          Math.abs(point.position.z),
                          point.position.y,
                          z,
                          y,
                          r * 1.6,
                          r,
                          r * 0.6,
                      ),
            (material, inside) => (inside ? SLOT.gloss : material),
        );
    }

    // Plastic lower lips, and full cladding on an off-roader.
    surface = clipSurface(
        surface,
        (point) => {
            const lip =
                lines.rocker(point.position.x) + (spec.cladding ? 0.12 : 0.04);

            return point.position.y - lip;
        },
        (material, inside) =>
            inside && material === SLOT.paint ? SLOT.plastic : material,
    );

    if (spec.cladding) {
        for (const axle of spec.axles) {
            surface = clipSurface(
                surface,
                (point) =>
                    Math.abs(point.normal.y) > 0.9
                        ? 1
                        : Math.hypot(
                              point.position.x - axle,
                              point.position.y - archCentre,
                          ) -
                          (spec.archRadius + 0.07),
                (material, inside) =>
                    inside && material === SLOT.paint ? SLOT.plastic : material,
            );
        }
    }

    // The panels.
    const materials: Record<number, THREE.Material> = {
        [SLOT.paint]: m.paint,
        [SLOT.glass]: m.glass,
        [SLOT.privacy]: m.privacyGlass,
        [SLOT.gloss]: m.gloss,
        [SLOT.plastic]: m.plastic,
        [SLOT.lens]: m.lens,
        [SLOT.redLens]: m.redLens,
        [SLOT.cowl]: m.plastic,
    };
    const see = new Set<number>([
        SLOT.glass,
        SLOT.privacy,
        SLOT.lens,
        SLOT.redLens,
    ]);

    for (const [slot, geometry] of surfaceGeometries(surface, {
        [SLOT.glass]: -0.004,
        [SLOT.privacy]: -0.004,
        [SLOT.lens]: -0.0015,
        [SLOT.redLens]: -0.0015,
    })) {
        const panel = mesh(geometry, materials[slot], !see.has(slot));
        panel.userData.seeThrough = see.has(slot);
        panel.userData.shell = true;
        body.add(panel);
    }

    const seam = clonePatched(m.liner);
    seam.polygonOffset = true;
    seam.polygonOffsetFactor = -2;
    seam.polygonOffsetUnits = -2;

    const addLines = (
        polylines: Polyline[],
        profile: THREE.Vector2[],
        material: THREE.Material,
        lift = 0,
        spacing = 0.012,
    ) => {
        for (const line of polylines) {
            if (line.points.length < 3) {
                continue;
            }

            const smooth = smoothPolyline(line, spacing, 2);
            const trim = mesh(
                sweepAlong(smooth, profile, {
                    closedProfile: profile.length > 4,
                    lift,
                }),
                material,
                false,
            );
            trim.userData.shell = true;
            body.add(trim);
        }
    };

    // Rubber seals round every pane, and a thin seam round each lamp.
    addLines(
        boundaries(
            surface,
            (slot) => slot === SLOT.glass || slot === SLOT.privacy,
        ),
        PROFILES.rounded(0.011, 0.004),
        m.rubber,
        -0.0035,
    );
    addLines(
        boundaries(
            surface,
            (slot) => slot === SLOT.lens || slot === SLOT.redLens,
        ),
        PROFILES.seam(0.004),
        seam,
    );

    // Shut lines: doors, bonnet, boot, fuel flap and bumper covers.
    const paintOnly = (slot: number) =>
        slot === SLOT.paint || slot === SLOT.plastic;
    const flank = (point: SurfacePoint) =>
        Math.abs(capOf(point)) < 0.4 &&
        girthOf(point) > 0.6 &&
        girthOf(point) < 6.0;

    for (const [atSill, atBelt] of spec.doorLines) {
        const sill = lines.rocker(atSill);
        const beltY = lines.belt(atBelt);
        addLines(
            contours(
                surface,
                (point) => {
                    const t = clamp01(
                        (point.position.y - sill) / (beltY - sill),
                    );

                    return point.position.x - lerp(atSill, atBelt, t);
                },
                paintOnly,
                flank,
            ),
            PROFILES.seam(),
            seam,
        );
    }

    // The bonnet: its back edge across the cowl, its sides along the tops
    // of the wings, and its front edge across the nose above the lamps.
    const bonnetFront = Math.max(...spec.headlamp.map(([, y]) => y)) + 0.012;
    const insideEdge = (x: number, margin: number) =>
        lines.width(x) - design.beltInset - margin;

    if (spec.bonnetRear < design.front - 0.2) {
        addLines(
            contours(
                surface,
                (point) =>
                    Math.max(
                        spec.bonnetRear - point.position.x,
                        Math.abs(point.position.z) -
                            insideEdge(point.position.x, 0.04),
                        bonnetFront - point.position.y,
                    ),
                paintOnly,
                (point) => point.position.x > spec.bonnetRear - 0.05,
            ),
            PROFILES.seam(),
            seam,
        );
    }

    // The boot lid or tailgate, down the back to just above the bumper.
    const bumperTop = lines.shoulder(design.rear + 0.3) - 0.2;

    if (spec.boot === 'lid' || spec.boot === 'tailgate') {
        const edge =
            spec.boot === 'lid' ? design.deck - 0.03 : design.rearHeader + 0.03;
        addLines(
            contours(
                surface,
                (point) =>
                    Math.max(
                        point.position.x - edge,
                        Math.abs(point.position.z) -
                            insideEdge(point.position.x, 0.05),
                        bumperTop + 0.04 - point.position.y,
                    ),
                paintOnly,
                (point) => point.position.x < edge + 0.05,
            ),
            PROFILES.seam(),
            seam,
        );
    }

    if (spec.fuel) {
        const [fuelX, fuelY] = spec.fuel;
        addLines(
            contours(
                surface,
                (point) =>
                    roundedBoxDistance(
                        point.position.x,
                        point.position.y,
                        fuelX,
                        fuelY,
                        0.085,
                        0.07,
                        0.025,
                    ),
                paintOnly,
                (point) =>
                    point.position.z > 0 && Math.abs(point.normal.z) > 0.5,
            ),
            PROFILES.seam(0.0035),
            seam,
        );
    }

    // Front bumper cover meets the wing behind the lamp.
    addLines(
        contours(
            surface,
            (point) =>
                point.position.x - (spec.axles[0] + spec.archRadius + 0.06),
            paintOnly,
            (point) =>
                Math.abs(point.position.z) > 0.3 &&
                point.position.y > lines.rocker(point.position.x) + 0.04 &&
                point.position.y < lines.shoulder(point.position.x) - 0.03,
        ),
        PROFILES.seam(),
        seam,
    );

    // Rear bumper cover's top edge, round the back.
    addLines(
        contours(
            surface,
            (point) => point.position.y - bumperTop,
            paintOnly,
            (point) =>
                point.position.x < spec.axles[1] - spec.archRadius - 0.05,
        ),
        PROFILES.seam(),
        seam,
    );

    // Arch lips: a rolled edge round each opening.
    const archLines = boundaries(surface, () => true).filter((line) =>
        spec.axles.some((axle) =>
            line.points.some(
                (p) =>
                    Math.abs(
                        Math.hypot(p.x - axle, p.y - archCentre) -
                            spec.archRadius,
                    ) < 0.01 && p.y > archCentre,
            ),
        ),
    );
    addLines(
        archLines.map((line) => {
            const axle = spec.axles.reduce((best, x) =>
                Math.abs(line.points[0].x - x) <
                Math.abs(line.points[0].x - best)
                    ? x
                    : best,
            );

            return orientLine(
                line,
                new THREE.Vector3(axle, archCentre, line.points[0].z),
            );
        }),
        spec.cladding ? PROFILES.lip(0.05, 0.012) : PROFILES.lip(0.03, 0.005),
        spec.cladding ? m.plastic : m.paint,
        0,
        0.01,
    );

    // Wheels, arch liners and something to look at through the spokes.
    const front = spec.axles[0];
    const liner = clonePatched(m.liner);
    liner.side = THREE.DoubleSide;

    for (const axle of spec.axles) {
        for (const side of (spec.wheelAxles ?? spec.axles).includes(axle)
            ? ([1, -1] as const)
            : []) {
            const wheel = buildWheel(m, spec.wheels, side);
            wheel.position.set(axle, wheelRadius, side * spec.track);

            if (axle === front) {
                wheel.rotation.y = side === 1 ? 0.1 : 0.1;
            }

            body.add(wheel);

            // A strut and knuckle behind the hub.
            const knuckle = box(
                0.08,
                0.2,
                0.06,
                m.castIron,
                axle,
                wheelRadius + 0.02,
                side * (spec.track - 0.16),
                0.02,
            );
            body.add(knuckle);
            body.add(
                rod(
                    [
                        axle - 0.02,
                        wheelRadius + 0.1,
                        side * (spec.track - 0.18),
                    ],
                    [
                        axle - 0.05,
                        wheelRadius + 0.3,
                        side * (spec.track - 0.26),
                    ],
                    0.028,
                    m.steel,
                ),
            );
        }

        if (spec.liners === false) {
            continue;
        }

        const well = new THREE.Mesh(
            new THREE.CylinderGeometry(
                spec.archRadius - 0.006,
                spec.archRadius - 0.006,
                2 * (lines.width(axle) - 0.012),
                40,
                1,
                true,
                Math.PI / 3,
                (Math.PI * 4) / 3,
            ),
            liner,
        );
        well.rotation.x = Math.PI / 2;
        well.position.set(axle, archCentre, 0);
        well.receiveShadow = true;
        body.add(well);
    }

    // Grille insert and the dark radiator behind it.
    buildGrille(m, spec, surface, body);

    // Lamp internals seen through the lenses.
    for (const side of [1, -1] as const) {
        buildHeadlampInside(m, surface, SLOT.lens, side, body);
        buildTaillampInside(m, surface, SLOT.redLens, side, body);
    }

    // Mirrors, handles, wipers, plates, badges, exhaust, aerial.
    for (const side of [1, -1] as const) {
        const hit = onBody(
            surface,
            new THREE.Vector3(
                spec.mirror,
                lines.belt(spec.mirror) + 0.07,
                side * 2,
            ),
            new THREE.Vector3(0, 0, -side),
        );

        if (hit && spec.mirrorStyle) {
            body.add(buildHeavyMirror(m, hit.position, side, spec.mirrorStyle));
        } else if (hit) {
            const mirror = buildMirror(m, hit.position, side);
            mirror.scale.setScalar(spec.mirrorScale ?? 1);
            body.add(mirror);
        }

        for (const x of spec.handles) {
            const handle = onBody(
                surface,
                new THREE.Vector3(x, lines.shoulder(x) + 0.03, side * 2),
                new THREE.Vector3(0, 0, -side),
            );

            if (handle) {
                const grip = softBox(0.14, 0.028, 0.03, m.paint, 0, 0, 0, {
                    divisions: [3, 1, 1],
                    crease: 0.6,
                });
                grip.position
                    .copy(handle.position)
                    .addScaledVector(handle.normal, 0.006);
                grip.lookAt(grip.position.clone().add(handle.normal));
                body.add(grip);
                const pocket = softBox(0.16, 0.05, 0.01, m.plastic, 0, 0, 0, {
                    crease: 0.3,
                });
                pocket.position
                    .copy(handle.position)
                    .addScaledVector(handle.normal, -0.002);
                pocket.lookAt(pocket.position.clone().add(handle.normal));
                body.add(pocket);
            }
        }
    }

    buildWipers(m, surface, design, body);

    if (spec.roofRails) {
        const [from, to, z] = spec.roofRails;
        roofRails(m, surface, from, to, z, body);
    }
    buildPlates(m, spec, surface, body, options.registration ?? null);

    if (spec.exhaust) {
        buildExhaust(
            m,
            spec.exhaust,
            design.rear,
            spec.axles,
            lines.rocker(0),
            body,
        );
    }

    const floor = box(
        design.front - design.rear - 1.0,
        0.03,
        spec.track * 2 - 0.35,
        m.underbody,
        (design.front + design.rear) / 2,
        lines.rocker(0) + 0.015,
        0,
        0.01,
    );
    body.add(floor);

    const fin = onBody(
        surface,
        new THREE.Vector3(design.rearHeader + 0.18, 3, 0),
        new THREE.Vector3(0, -1, 0),
    );

    if (fin && design.rearHeader - design.deck > 0.05) {
        const aerial = softBox(0.16, 0.06, 0.05, m.gloss, 0, 0, 0, {
            divisions: [3, 2, 1],
            crease: 0.4,
            shape: (p) => {
                // Taller at the back, like a shark fin.
                const t = (0.08 - p.x) / 0.16;
                p.y *= 0.35 + 0.65 * t;
                p.y += 0.03 * t;
            },
        });
        aerial.position.copy(fin.position);
        body.add(aerial);
    }

    buildCabin(m, spec, shell, surface, body, options.rightHandDrive ?? false);

    return spec.bay;
}

/**
 * Tailpipes out of the back, the pipe running forward under the floor and
 * a silencer tucked up between the rear wheels.
 */
export function buildExhaust(
    m: Materials,
    exhaust: { y: number; z: number; twin?: boolean },
    rear: number,
    axles: [number, number],
    floor: number,
    body: THREE.Group,
): void {
    const pipe = clonePatched(m.chrome);
    pipe.side = THREE.DoubleSide;

    for (const z of exhaust.twin ? [exhaust.z, -exhaust.z] : [exhaust.z]) {
        body.add(
            cyl(0.042, 0.12, pipe, 'x', rear + 0.06, exhaust.y, z, {
                open: true,
                segments: 28,
            }),
        );
        body.add(cyl(0.036, 0.004, m.liner, 'x', rear + 0.08, exhaust.y, z));
        body.add(
            tube(
                [
                    [rear + 0.05, exhaust.y, z],
                    [rear + 0.5, exhaust.y - 0.03, z * 0.95],
                    [axles[1] - 0.2, floor - 0.06, z * 0.7],
                    [0, floor - 0.07, 0.12],
                    [axles[0] - 0.4, floor - 0.05, 0.08],
                ],
                0.028,
                m.exhaust,
            ),
        );
    }

    body.add(
        box(
            0.6,
            0.14,
            0.32,
            m.stainless,
            axles[1] + 0.15,
            floor - 0.05,
            0.3,
            0.05,
        ),
    );
}

/**
 * A door mirror's housing for the right-hand side: half a superellipsoid,
 * domed into the wind and cut flat at the back where the glass goes, lower
 * and slimmer towards its outer end. The outline of the open back comes
 * with it, as (z, y) points, for the glass.
 */
function mirrorHousing(): {
    geometry: THREE.BufferGeometry;
    outline: Point[];
} {
    const depth = 0.088;
    const height = 0.064;
    const reach = 0.118;
    const rows = 18;
    const columns = 26;
    const power = (value: number, exponent: number): number =>
        Math.sign(value) * Math.pow(Math.abs(value), exponent);
    const at = (u: number, v: number): THREE.Vector3 => {
        const cu = power(Math.cos(u), 0.5);
        const z = reach * cu * power(Math.sin(v), 0.7);
        const outer = (z / reach + 1) / 2;

        return new THREE.Vector3(
            depth * cu * power(Math.cos(v), 0.7) * (1 - outer * outer * 0.3),
            height * power(Math.sin(u), 0.5) * (1 - outer * 0.16) -
                outer * 0.006,
            z,
        );
    };
    const positions: number[] = [];
    const index: number[] = [];

    for (let i = 0; i <= rows; i++) {
        for (let j = 0; j <= columns; j++) {
            const point = at(
                -Math.PI / 2 + (i / rows) * Math.PI,
                -Math.PI / 2 + (j / columns) * Math.PI,
            );
            positions.push(point.x, point.y, point.z);
        }
    }

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const a = i * (columns + 1) + j;
            const c = a + columns + 1;
            index.push(a, c, a + 1, a + 1, c, c + 1);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(index);
    geometry.computeVertexNormals();

    const outline: Point[] = [];

    for (const v of [Math.PI / 2, -Math.PI / 2]) {
        for (let i = 0; i <= rows * 2; i++) {
            const t = i / (rows * 2);
            const u =
                v > 0 ? -Math.PI / 2 + t * Math.PI : Math.PI / 2 - t * Math.PI;
            const point = at(u, v);
            outline.push([point.z, point.y]);
        }
    }

    return { geometry, outline };
}

/**
 * A door mirror on its black sail: the painted housing, the glass in a
 * black surround, and an indicator repeater under the leading edge.
 */
function buildMirror(
    m: Materials,
    base: THREE.Vector3,
    side: 1 | -1,
): THREE.Group {
    const mirror = new THREE.Group();
    mirror.position.copy(base);

    // The head is built for the right-hand side and mirrored for the left.
    const head = new THREE.Group();
    head.position.set(-0.095, 0.078, side * 0.155);
    head.scale.z = side;
    const { geometry, outline } = mirrorHousing();
    head.add(new THREE.Mesh(geometry, m.paint));

    // The glass sits a little way in; the surround's opening is smaller
    // than the glass so no gap shows between them.
    const scaled = (sz: number, sy: number): THREE.Vector2[] =>
        outline.map(([z, y]) => new THREE.Vector2(z * sz, y * sy));
    const surround = new THREE.Shape(scaled(1, 1));
    surround.holes.push(new THREE.Path(scaled(0.9, 0.86)));
    const rim = new THREE.ShapeGeometry(surround, 2);
    rim.rotateY(-Math.PI / 2);
    head.add(place(new THREE.Mesh(rim, m.gloss), -0.0005, 0, 0));
    const pane = new THREE.ShapeGeometry(new THREE.Shape(scaled(0.93, 0.9)), 2);
    pane.rotateY(-Math.PI / 2);
    head.add(place(new THREE.Mesh(pane, m.mirror), 0.002, 0, 0));
    head.add(box(0.026, 0.008, 0.1, m.amberLens, 0.05, -0.062, 0.035, 0.003));
    mirror.add(head);

    const sail = softBox(
        0.11,
        0.04,
        0.085,
        m.gloss,
        -0.035,
        0.035,
        side * 0.045,
        {
            crease: 0.4,
            shape: (p) => {
                // Narrowing from the door out to the head.
                p.x *= 1 - ((p.z * side + 0.0425) / 0.085) * 0.3;
            },
        },
    );
    mirror.add(sail);
    mirror.traverse((object) => {
        object.userData.shell = true;

        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    return mirror;
}

/**
 * A heavy vehicle's mirror: a tall main glass with a wide-angle spotter
 * under it, each in a black plastic head. A truck carries them on a frame
 * of tubes out from the door; a bus hangs them forward of the windscreen
 * from an arm curving over from the pillar.
 */
function buildHeavyMirror(
    m: Materials,
    base: THREE.Vector3,
    side: 1 | -1,
    style: 'truck' | 'bus',
): THREE.Group {
    const mirror = new THREE.Group();
    mirror.position.copy(base);
    const head = (
        x: number,
        y: number,
        z: number,
        height: number,
        width: number,
    ): void => {
        mirror.add(box(0.06, height, width, m.plastic, x, y, z, 0.018));
        mirror.add(
            box(
                0.004,
                height - 0.03,
                width - 0.025,
                m.mirror,
                x - 0.031,
                y,
                z,
                0.002,
            ),
        );
    };

    if (style === 'truck') {
        for (const y of [0, 0.44]) {
            mirror.add(
                bentTube(
                    [
                        [-0.02, y, 0],
                        [0.04, y, side * 0.12],
                        [0.04, y, side * 0.2],
                    ],
                    0.013,
                    m.gloss,
                    0.04,
                ),
            );
        }

        mirror.add(
            rod(
                [0.04, -0.06, side * 0.2],
                [0.04, 0.5, side * 0.2],
                0.013,
                m.gloss,
            ),
        );
        head(0.04, 0.27, side * 0.31, 0.38, 0.2);
        head(0.04, -0.02, side * 0.29, 0.15, 0.16);
    } else {
        mirror.add(
            tube(
                [
                    [0, 0.42, side * 0.01],
                    [0.12, 0.7, side * 0.05],
                    [0.4, 0.8, side * 0.1],
                    [0.6, 0.64, side * 0.13],
                ],
                0.018,
                m.gloss,
            ),
        );
        head(0.62, 0.42, side * 0.14, 0.34, 0.2);
        head(0.62, 0.16, side * 0.14, 0.14, 0.17);
    }

    mirror.traverse((object) => {
        object.userData.shell = true;
    });

    return mirror;
}

function buildWipers(
    m: Materials,
    surface: Surface,
    design: BodyDesign,
    body: THREE.Group,
): void {
    for (const [z0, z1] of [
        [0.52, -0.08],
        [-0.12, -0.62],
    ] as [number, number][]) {
        const points: [number, number, number][] = [];

        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const x = design.cowl - 0.05 - t * 0.08;
            const z = lerp(z0, z1, t);
            const hit = raycastSurface(
                surface,
                new THREE.Vector3(x, 3, z),
                new THREE.Vector3(0, -1, 0),
            );

            if (hit) {
                const p = hit.position
                    .clone()
                    .addScaledVector(hit.normal, 0.012);
                points.push([p.x, p.y, p.z]);
            }
        }

        if (points.length > 3) {
            const blade = tube(points, 0.007, m.rubber, { radial: 6 });
            blade.userData.shell = true;
            body.add(blade);
            const arm = tube(
                points.filter((_, i) => i % 2 === 0),
                0.0045,
                m.gloss,
                { radial: 6 },
            );
            arm.position.y += 0.012;
            arm.userData.shell = true;
            body.add(arm);
        }
    }
}

function buildPlates(
    m: Materials,
    spec: RoadSpec,
    surface: Surface,
    body: THREE.Group,
    registration: string | null,
): void {
    const texture = plateTexture(registration);
    const face = texture
        ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 })
        : m.plate;

    for (const [end, y] of [
        ['front', spec.plate.front],
        ['rear', spec.plate.rear],
    ] as ['front' | 'rear', number][]) {
        if (y <= 0) {
            continue;
        }

        const direction = end === 'front' ? -1 : 1;
        const hit = raycastSurface(
            surface,
            new THREE.Vector3(end === 'front' ? 4 : -4, y, 0),
            new THREE.Vector3(direction, 0, 0),
        );

        if (!hit) {
            continue;
        }

        const plate = new THREE.Group();
        plate.position.copy(hit.position).addScaledVector(hit.normal, 0.012);
        plate.lookAt(plate.position.clone().add(hit.normal));
        plate.add(box(0.53, 0.125, 0.012, m.plastic, 0, 0, -0.004, 0.004));
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.11), face);
        panel.position.z = 0.0025;
        plate.add(panel);
        plate.userData.shell = true;
        body.add(plate);
    }
}

/**
 * Walls running back from the edge of an opening, so a grille, intake or
 * lamp reads as a deep recess rather than a hole into the body.
 */
function tunnel(
    line: Polyline,
    depth: number,
    material: THREE.Material,
    direction?: THREE.Vector3,
): THREE.Mesh {
    const smooth = smoothPolyline(line, 0.006, 1);
    const points = smooth.points;
    const count = points.length;
    const centre = points
        .reduce((sum, p) => sum.add(p), new THREE.Vector3())
        .divideScalar(count);
    const positions: number[] = [];
    const normals: number[] = [];
    const segments = smooth.closed ? count : count - 1;
    const deep = (i: number) =>
        points[i]
            .clone()
            .addScaledVector(
                direction ?? smooth.normals[i].clone().negate(),
                depth,
            );

    for (let i = 0; i < segments; i++) {
        const j = (i + 1) % count;
        const a = points[i];
        const b = points[j];
        const c = deep(j);
        const d = deep(i);
        const normal = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
        const inward = centre.clone().sub(a);
        const flip = normal.dot(inward) < 0;
        const quad = flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d];

        if (flip) {
            normal.negate();
        }

        for (const p of quad) {
            positions.push(p.x, p.y, p.z);
            normals.push(normal.x, normal.y, normal.z);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(normals, 3),
    );

    return mesh(geometry, material, false);
}

function buildGrille(
    m: Materials,
    spec: RoadSpec,
    surface: Surface,
    body: THREE.Group,
): void {
    const openings = boundaries(surface, () => true);

    for (const outline of [spec.grille, spec.intake].filter(
        Boolean,
    ) as Point[][]) {
        const zs = outline.map(([z]) => z);
        const ys = outline.map(([, y]) => y);
        const reach = Math.max(...zs);
        const top = Math.max(...ys);
        const bottom = Math.min(...ys);
        // The face of the fascia at the opening's top and bottom edges; the
        // insert sits behind whichever is further back.
        const faces = [top + 0.02, bottom - 0.015].map((y) => {
            const hit = raycastSurface(
                surface,
                new THREE.Vector3(5, y, 0.001),
                new THREE.Vector3(-1, 0, 0),
            );

            return hit ? hit.position.x : spec.design.front;
        });
        const face = Math.min(...faces);
        const depth = 0.07;
        const x = face - depth;

        for (const line of openings) {
            const inside = line.points.every(
                (p) =>
                    p.x > spec.design.front - 0.45 &&
                    Math.abs(p.z) < reach + 0.03 &&
                    p.y > bottom - 0.03 &&
                    p.y < top + 0.03,
            );

            if (inside) {
                body.add(
                    tunnel(line, 0.2, m.liner, new THREE.Vector3(-1, 0, 0)),
                );
            }
        }

        // Gloss slats standing in the opening, with a dark mesh and the
        // radiator behind them.
        const slats = Math.max(2, Math.round((top - bottom) / 0.04));

        for (let i = 0; i < slats; i++) {
            const y = bottom + ((i + 0.5) / slats) * (top - bottom);
            const half = Math.max(0.05, rowWidth(outline, y));
            const slat = box(
                0.03,
                0.01,
                half * 2 + 0.03,
                m.gloss,
                x + 0.035,
                y,
                0,
                0.004,
            );
            slat.rotation.z = -0.3;
            body.add(slat);
        }

        body.add(
            box(
                0.008,
                top - bottom + 0.05,
                reach * 2 + 0.05,
                m.liner,
                x,
                (top + bottom) / 2,
                0,
                0.002,
            ),
        );
        body.add(
            box(
                0.05,
                top - bottom + 0.1,
                reach * 2 + 0.1,
                m.castIron,
                x - 0.1,
                (top + bottom) / 2,
                0,
                0.004,
            ),
        );
    }
}

/**
 * How wide an outline is at a given height.
 */
function rowWidth(outline: Point[], y: number): number {
    let widest = 0;

    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [z1, y1] = outline[i];
        const [z2, y2] = outline[j];

        if (y1 > y !== y2 > y) {
            widest = Math.max(widest, z1 + ((y - y1) / (y2 - y1)) * (z2 - z1));
        }
    }

    return widest;
}

function buildHeadlampInside(
    m: Materials,
    surface: Surface,
    slot: number,
    side: 1 | -1,
    body: THREE.Group,
): void {
    const centre = slotCentre(surface, slot, side);

    if (!centre) {
        return;
    }

    // The black bucket behind the lens, walled in round its edge.
    const housing = mesh(
        offsetCopy(surface, [slot], -0.045, (c) => Math.sign(c.z) === side),
        m.gloss,
        false,
    );
    body.add(housing);

    for (const edge of boundaries(surface, (s) => s === slot).filter((line) =>
        line.points.every((p) => Math.sign(p.z) === side),
    )) {
        body.add(tunnel(edge, 0.045, m.gloss));
    }

    // Twin projector modules in chrome bowls, and an LED light guide.
    const inward = new THREE.Vector3(-1, 0, -side * 0.35).normalize();
    for (const [dz, size] of [
        [-0.07, 0.034],
        [0.05, 0.03],
    ] as [number, number][]) {
        const at = centre.clone().addScaledVector(inward, 0.03);
        at.z += side * dz;
        const bowl = lathe(
            [
                [0.004, -0.03],
                [size * 0.8, -0.02],
                [size * 1.15, 0.0],
                [size * 1.2, 0.006],
            ],
            m.reflector,
            'x',
            at.x,
            at.y,
            at.z,
            32,
        );
        body.add(bowl);
        const lens = new THREE.Mesh(
            new THREE.SphereGeometry(
                size * 0.72,
                24,
                12,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2.2,
            ),
            m.lens,
        );
        lens.rotation.z = -Math.PI / 2;
        lens.position.set(at.x + 0.004, at.y, at.z);
        lens.userData.seeThrough = true;
        body.add(lens);
        body.add(
            torus(size * 0.75, 0.004, m.gloss, 'x', at.x + 0.006, at.y, at.z, {
                radial: 8,
                tubular: 32,
            }),
        );
    }

    const edges = boundaries(surface, (s) => s === slot).filter((line) =>
        line.points.every((p) => Math.sign(p.z) === side),
    );

    for (const edge of edges) {
        const smooth = smoothPolyline(edge, 0.01, 3);
        const guide: Polyline = {
            points: smooth.points.map((p) =>
                p.clone().lerp(centre, 0.22).addScaledVector(inward, 0.015),
            ),
            normals: smooth.normals,
            closed: smooth.closed,
        };
        // Only the lower sweep of the outline glows, like a DRL signature.
        const lower: Polyline = {
            points: guide.points.filter((p) => p.y < centre.y),
            normals: guide.normals.filter(
                (_, i) => guide.points[i].y < centre.y,
            ),
            closed: false,
        };

        if (lower.points.length > 4) {
            body.add(
                mesh(
                    sweepAlong(lower, PROFILES.rounded(0.008, 0.004)),
                    m.led,
                    false,
                ),
            );
        }
    }
}

function buildTaillampInside(
    m: Materials,
    surface: Surface,
    slot: number,
    side: 1 | -1,
    body: THREE.Group,
): void {
    const centre = slotCentre(surface, slot, side);

    if (!centre) {
        return;
    }

    body.add(
        mesh(
            offsetCopy(surface, [slot], -0.03, (c) => Math.sign(c.z) === side),
            m.reflector,
            false,
        ),
    );

    for (const edge of boundaries(surface, (s) => s === slot).filter((line) =>
        line.points.every((p) => Math.sign(p.z) === side),
    )) {
        body.add(tunnel(edge, 0.03, m.gloss));
    }

    const glow = new THREE.MeshStandardMaterial({
        color: 0x3a0306,
        emissive: 0xff1a22,
        emissiveIntensity: 0.9,
        roughness: 0.5,
    });

    for (const edge of boundaries(surface, (s) => s === slot).filter((line) =>
        line.points.every((p) => Math.sign(p.z) === side),
    )) {
        const smooth = smoothPolyline(edge, 0.01, 3);
        const guide: Polyline = {
            points: smooth.points.map((p) =>
                p
                    .clone()
                    .lerp(centre, 0.3)
                    .add(new THREE.Vector3(0.014, 0, 0)),
            ),
            normals: smooth.normals,
            closed: smooth.closed,
        };
        body.add(
            mesh(
                sweepAlong(guide, PROFILES.rounded(0.007, 0.004)),
                glow,
                false,
            ),
        );
    }

    // A clear reversing lamp at the inboard end.
    const reverse = centre.clone();
    reverse.z -= side * 0.08;
    reverse.x += 0.012;
    body.add(
        puck(0.022, 0.01, m.reflector, 'x', reverse.x, reverse.y, reverse.z),
    );
}

function buildCabin(
    m: Materials,
    spec: RoadSpec,
    shell: BodyShell,
    surface: Surface,
    body: THREE.Group,
    rightHandDrive: boolean,
): void {
    const design = spec.design;
    const lines = shell.lines;
    const cabin = new THREE.Group();
    body.add(cabin);

    const floorY = lines.rocker(0) + 0.1;
    const cowl = design.cowl;
    const beltY = lines.belt(cowl - 0.4);
    const half = spec.track - 0.02;

    // Lining: the inside of the doors and roof.
    const lining = mesh(
        offsetCopy(
            surface,
            [SLOT.paint, SLOT.gloss, SLOT.plastic, SLOT.cowl],
            -0.03,
            (c) => c.x < cowl + 0.1 && c.x > design.deck - 0.1 && c.y > floorY,
        ),
        m.cabin,
        false,
    );
    cabin.add(lining);

    cabin.add(
        box(
            cowl - design.deck,
            0.04,
            half * 1.9,
            m.carpet,
            (cowl + design.deck) / 2,
            floorY,
            0,
            0.01,
        ),
    );

    // Dashboard across the car, with the instrument binnacle.
    // It sits well back from the screen and falls away towards it.
    const dash = softBox(
        0.5,
        0.18,
        half * 1.8,
        m.dash,
        cowl - 0.5,
        beltY - 0.1,
        0,
        {
            divisions: [3, 2, 4],
            crease: 0.6,
            shape: (p) => {
                p.y -= Math.max(0, p.x / 0.25) * 0.06;
            },
        },
    );
    cabin.add(dash);
    const driver = rightHandDrive ? 1 : -1;
    const wheelX = cowl - 0.62;
    const wheelY = beltY + 0.02;
    const wheelZ = driver * 0.36;
    cabin.add(
        softBox(0.14, 0.08, 0.34, m.dash, cowl - 0.46, beltY + 0.05, wheelZ, {
            crease: 0.4,
        }),
    );

    const steering = new THREE.Group();
    steering.position.set(wheelX, wheelY, wheelZ);
    steering.rotation.z = -1.15;
    steering.add(
        torus(0.18, 0.017, m.dash, 'x', 0, 0, 0, { radial: 12, tubular: 48 }),
    );
    steering.add(puck(0.06, 0.05, m.dash, 'x', 0.01, 0, 0));
    for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        const spoke = box(
            0.015,
            0.14,
            0.025,
            m.dash,
            0.005,
            Math.cos(angle) * 0.08,
            Math.sin(angle) * 0.08,
            0.006,
        );
        spoke.rotation.x = -angle;
        steering.add(spoke);
    }
    cabin.add(steering);
    cabin.add(
        rod(
            [wheelX + 0.02, wheelY - 0.01, wheelZ],
            [cowl - 0.3, beltY - 0.1, wheelZ],
            0.025,
            m.dash,
        ),
    );

    // Centre console and gear selector.
    cabin.add(
        softBox(0.9, 0.16, 0.2, m.dash, cowl - 0.8, floorY + 0.12, 0, {
            crease: 0.5,
            divisions: [3, 1, 1],
        }),
    );
    cabin.add(
        softBox(0.06, 0.08, 0.05, m.gloss, cowl - 0.68, floorY + 0.24, 0, {
            crease: 0.3,
        }),
    );

    // Seats: bolstered cushions and backs with headrests.
    spec.seats.rows.forEach((x, row) => {
        const bench = row > 0 && spec.seats.bench !== false;
        const places = bench ? [0] : [-0.36, 0.36];

        for (const z of places) {
            const width = bench ? half * 1.75 : 0.5;
            const seat = new THREE.Group();
            seat.position.set(x, floorY + 0.02, z);
            seat.add(
                softBox(0.5, 0.13, width, m.seat, 0, 0.26, 0, {
                    divisions: [2, 1, 3],
                    crease: 0.3,
                    shape: (p) => {
                        // Side bolsters stand proud.
                        p.y += Math.pow(Math.abs(p.z) / (width / 2), 4) * 0.03;
                    },
                }),
            );
            const back = softBox(0.12, 0.6, width, m.seat, -0.25, 0.6, 0, {
                divisions: [1, 3, 3],
                crease: 0.3,
                shape: (p) => {
                    p.x += Math.pow(Math.abs(p.z) / (width / 2), 4) * 0.03;
                },
            });
            back.rotation.z = 0.2;
            seat.add(back);

            let squash = 1;

            for (const dz of bench ? [-half * 0.55, half * 0.55] : [0]) {
                seat.add(
                    softBox(0.09, 0.14, 0.24, m.seat, -0.34, 0.97, dz, {
                        crease: 0.4,
                    }),
                );

                // Under a low roof, as in a coupe's back seat, the seat
                // sits lower so its headrest stays inside.
                const roof = raycastSurface(
                    surface,
                    new THREE.Vector3(x - 0.34, 4, z + dz),
                    new THREE.Vector3(0, -1, 0),
                );

                if (roof) {
                    const room = roof.position.y - 0.07 - (floorY + 0.02);
                    squash = Math.min(squash, room / 1.04);
                }
            }

            seat.scale.y = THREE.MathUtils.clamp(squash, 0.6, 1);
            cabin.add(seat);
        }
    });

    cabin.traverse((object) => {
        object.userData.ghost = 'hide';
    });
}

/**
 * A pair of roof rails on raised feet.
 */
export function roofRails(
    m: Materials,
    surface: Surface,
    from: number,
    to: number,
    z: number,
    body: THREE.Group,
): void {
    for (const side of [1, -1]) {
        const points: [number, number, number][] = [];

        for (let i = 0; i <= 10; i++) {
            const x = lerp(from, to, i / 10);
            const hit = raycastSurface(
                surface,
                new THREE.Vector3(x, 4, side * z),
                new THREE.Vector3(0, -1, 0),
            );

            if (hit) {
                const lift = i === 0 || i === 10 ? 0.015 : 0.045;
                points.push([x, hit.position.y + lift, side * z]);
            }
        }

        if (points.length > 3) {
            body.add(bentTube(points, 0.014, m.satin, 0.1));
        }
    }
}
