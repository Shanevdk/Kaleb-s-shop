import * as THREE from 'three';
import { clamp01, lerp, smoothCurve } from '@/lib/three/curves';
import {
    edgeKey,
    emptyCage,
    subdivideQuads,
    type Cage,
} from '@/lib/three/subdivide';
import { surfaceFromQuads, type Surface } from '@/lib/three/surface';

/**
 * [x, value] keys for one line of the body, front (+x) to rear.
 */
export type Line = [number, number][];

/**
 * A road vehicle's body drawn the way a designer's lines plan is: a few
 * lines in side view (rocker, shoulder, belt, the roofline down the
 * middle, the top of the glass), a few in plan (the widest line and the
 * width at the top of the glass), where the glasshouse starts and stops,
 * and how round the corners are. The shell is lofted through sections cut
 * from those lines, capped front and rear, and then subdivided smooth.
 *
 * +X is forward, +Y up, +Z to the right, the ground is y = 0 and x = 0 is
 * halfway between the axles.
 */
export type BodyDesign = {
    front: number;
    rear: number;
    rocker: Line;
    shoulder: Line;
    belt: Line;
    roof: Line;
    glassTop: Line;
    width: Line;
    glassWidth: Line;
    /** Where the windscreen meets the bonnet, and the roof starts. */
    cowl: number;
    header: number;
    /** Where the roof ends and the rear glass meets the deck. */
    rearHeader: number;
    deck: number;
    /** How far the sill tucks under from the widest line. */
    tuck: number;
    /** How far the belt steps in from the shoulder. */
    beltInset: number;
    /** Plan-view corner radius at the front and rear. */
    cornerFront: number;
    cornerRear: number;
    /** How far the fascias bulge past their edges. */
    frontBow: number;
    rearBow: number;
    /** Where down each fascia the bulge is greatest, 0 bottom to 1 top. */
    frontBowHeight?: number;
    rearBowHeight?: number;
    /** Crease sharpness along the shoulder line. */
    shoulderCrease?: number;
    /** How many subdivision levels to refine the cage. */
    levels?: number;
};

/** Girth rows on each side, from the underside return to the centreline. */
export const GIRTH = 11;

/**
 * The girth rows by name, bottom to top. Rows 6 and 7 bound the side glass,
 * 7 to 8 is the roof rail or pillar, and 8 up is the roof, windscreen or
 * rear glass.
 */
export const ROW = {
    under: 0,
    rocker: 1,
    lower: 2,
    door: 3,
    shoulder: 4,
    belt: 5,
    glassBottom: 6,
    glassTop: 7,
    rail: 8,
    centre: GIRTH,
} as const;

/** Attribute channels carried through subdivision. */
export const CHANNEL = {
    /** Girth coordinate, 0 at the underside to 11 on the centreline. */
    girth: 0,
    /** 1 inside the front fascia, -1 inside the rear, 0 on the sides. */
    cap: 1,
} as const;

export type BodyShell = {
    design: BodyDesign;
    surface: Surface;
    stations: number[];
    /** The resolved lines, for placing things on the body. */
    lines: ResolvedLines;
};

export type ResolvedLines = {
    rocker: (x: number) => number;
    shoulder: (x: number) => number;
    belt: (x: number) => number;
    roof: (x: number) => number;
    glassTop: (x: number) => number;
    width: (x: number) => number;
    glassWidth: (x: number) => number;
    /** 0 over the bonnet and deck, 1 under the roof. */
    presence: (x: number) => number;
};

export function resolveLines(design: BodyDesign): ResolvedLines {
    // Linear ramps keep the A and C pillars straight in side view.
    const presence = (x: number) => {
        const rise =
            design.cowl - design.header < 1e-3
                ? 1
                : clamp01((design.cowl - x) / (design.cowl - design.header));
        const fall =
            design.rearHeader - design.deck < 1e-3
                ? 1
                : clamp01(
                      (x - design.deck) / (design.rearHeader - design.deck),
                  );

        return Math.min(rise, fall);
    };

    return {
        rocker: smoothCurve(design.rocker),
        shoulder: smoothCurve(design.shoulder),
        belt: smoothCurve(design.belt),
        roof: smoothCurve(design.roof),
        glassTop: smoothCurve(design.glassTop),
        width: smoothCurve(design.width),
        glassWidth: smoothCurve(design.glassWidth),
        presence,
    };
}

/**
 * Stations along the body: close together round the corners where the
 * width changes fast, at every place something starts or stops, and no
 * further apart than a hand's width elsewhere.
 */
function stationList(design: BodyDesign): number[] {
    const { front, rear, cornerFront, cornerRear } = design;
    const set = new Set<number>();
    const add = (x: number) => set.add(Math.round(x * 1000) / 1000);

    for (const angle of [0, 14, 28, 42, 56, 70, 84]) {
        const a = THREE.MathUtils.degToRad(angle);
        add(front - cornerFront * (1 - Math.cos(a)));
        add(rear + cornerRear * (1 - Math.cos(a)));
    }

    add(front - cornerFront * 1.25);
    add(rear + cornerRear * 1.25);

    for (const x of [
        design.cowl,
        design.header,
        design.rearHeader,
        design.deck,
    ]) {
        if (x < front - 0.02 && x > rear + 0.02) {
            add(x);
        }
    }

    let list = [...set].sort((a, b) => b - a);
    const spacing = 0.2;
    const filled: number[] = [];

    for (let i = 0; i < list.length; i++) {
        filled.push(list[i]);

        if (i < list.length - 1) {
            const gap = list[i] - list[i + 1];
            const extra = Math.floor(gap / spacing);

            for (let j = 1; j <= extra; j++) {
                filled.push(list[i] - (gap * j) / (extra + 1));
            }
        }
    }

    // Drop stations squeezed too close together.
    list = [];

    for (const x of filled) {
        if (list.length === 0 || list[list.length - 1] - x > 0.025) {
            list.push(x);
        }
    }

    if (list[list.length - 1] !== rear) {
        list[list.length - 1] = rear;
    }

    return list;
}

/**
 * How much of a row's width survives at x, given the corner radius the row
 * rounds off with at each end.
 */
function cornerWidth(
    width: number,
    x: number,
    design: BodyDesign,
    scale: number,
): number {
    const rf = design.cornerFront * scale;
    const rr = design.cornerRear * scale;
    const toFront = design.front - x;
    const toRear = x - design.rear;
    let result = width;

    if (toFront < rf) {
        const d = rf - toFront;
        result = Math.min(
            result,
            width - rf + Math.sqrt(Math.max(0, rf * rf - d * d)),
        );
    }

    if (toRear < rr) {
        const d = rr - toRear;
        result = Math.min(
            result,
            width - rr + Math.sqrt(Math.max(0, rr * rr - d * d)),
        );
    }

    return result;
}

/**
 * The right half of the section at station x, underside to centreline.
 */
export function sectionAt(
    design: BodyDesign,
    lines: ResolvedLines,
    x: number,
): THREE.Vector2[] {
    const rockerY = lines.rocker(x);
    const shoulderY = lines.shoulder(x);
    const beltY = lines.belt(x);
    const roofY = lines.roof(x);
    const railY = lines.glassTop(x);
    const width = lines.width(x);
    const p = lines.presence(x);

    const rockerZ = cornerWidth(width - design.tuck, x, design, 1.12);
    const lowerZ = cornerWidth(width - 0.012, x, design, 1.06);
    const doorZ = cornerWidth(width - 0.003, x, design, 1.02);
    const shoulderZ = cornerWidth(width, x, design, 1);
    const beltZ = cornerWidth(width - design.beltInset, x, design, 1);
    const body = shoulderY - rockerY;

    const points: THREE.Vector2[] = [
        new THREE.Vector2(rockerZ - 0.055, rockerY + 0.012),
        new THREE.Vector2(rockerZ, rockerY),
        new THREE.Vector2(lowerZ, rockerY + body * 0.3),
        new THREE.Vector2(doorZ, rockerY + body * 0.68),
        new THREE.Vector2(shoulderZ, shoulderY),
        new THREE.Vector2(beltZ, beltY),
    ];

    // Across a bonnet or deck: the rows fan out from the edge to the
    // centreline, gathered near the edge where the panel turns down.
    const crown = (f: number) => 1 - (1 - f) * (1 - f);
    const flat = [0.045, 0.1, 0.19, 0.42, 0.72, 1].map((f) => {
        return new THREE.Vector2(
            beltZ * (1 - f),
            beltY + (roofY - beltY) * crown(f),
        );
    });

    // Under the roof: up the side glass, over the rail, across the roof.
    const glassZ = Math.min(
        beltZ - 0.02,
        cornerWidth(lines.glassWidth(x), x, design, 0.8),
    );
    const top = railY + 0.035;
    const roofCentre = Math.max(roofY, top + 0.01);
    const edgeZ = glassZ - 0.055;
    const raised = [
        new THREE.Vector2(beltZ - 0.012, beltY + 0.035),
        new THREE.Vector2(glassZ, railY),
        new THREE.Vector2(edgeZ, top),
        ...[0.42, 0.76, 1].map(
            (f) =>
                new THREE.Vector2(
                    edgeZ * (1 - f),
                    top + (roofCentre - top) * crown(f),
                ),
        ),
    ];

    for (let i = 0; i < 6; i++) {
        points.push(
            new THREE.Vector2(
                lerp(flat[i].x, raised[i].x, p),
                lerp(flat[i].y, raised[i].y, p),
            ),
        );
    }

    points[GIRTH].x = 0;

    return points;
}

/**
 * Build the control cage: a loft of sections down the body, with a cap
 * over each end filled in from its four edges and bowed outwards.
 */
export function buildBodyCage(
    design: BodyDesign,
    lines: ResolvedLines,
): {
    cage: Cage;
    stations: number[];
} {
    const stations = stationList(design);
    const cage = emptyCage(2);
    const K = GIRTH * 2 + 1;
    const index = (s: number, k: number) => s * K + k;

    const push = (point: THREE.Vector3, girth: number, cap: number) => {
        cage.positions.push(point.x, point.y, point.z);
        cage.attributes.push(girth, cap);

        return cage.positions.length / 3 - 1;
    };

    const tube: THREE.Vector3[][] = stations.map((x) => {
        const half = sectionAt(design, lines, x);
        const ring: THREE.Vector3[] = [];

        for (let k = 0; k < K; k++) {
            const g = k <= GIRTH ? k : 2 * GIRTH - k;
            const point = half[g];
            ring.push(
                new THREE.Vector3(x, point.y, k <= GIRTH ? point.x : -point.x),
            );
        }

        return ring;
    });

    tube.forEach((ring) =>
        ring.forEach((point, k) =>
            push(point, k <= GIRTH ? k : 2 * GIRTH - k, 0),
        ),
    );

    for (let s = 0; s < stations.length - 1; s++) {
        for (let k = 0; k < K - 1; k++) {
            cage.faces.push([
                index(s, k),
                index(s, k + 1),
                index(s + 1, k + 1),
                index(s + 1, k),
            ]);
            cage.materials.push(0);
        }
    }

    const crease = design.shoulderCrease ?? 1.4;

    if (crease > 0) {
        for (let s = 0; s < stations.length - 1; s++) {
            for (const k of [ROW.shoulder, 2 * GIRTH - ROW.shoulder]) {
                cage.creases.set(edgeKey(index(s, k), index(s + 1, k)), crease);
            }
        }
    }

    // The fascias. Rows run up the side edge (girth 0 to belt), columns run
    // across the top edge from the left belt to the right belt.
    const sideRows = ROW.belt;
    const columns = 2 * (GIRTH - ROW.belt);

    for (const end of ['front', 'rear'] as const) {
        const s = end === 'front' ? 0 : stations.length - 1;
        const ring = tube[s];
        const bow = end === 'front' ? design.frontBow : design.rearBow;
        const peak =
            (end === 'front' ? design.frontBowHeight : design.rearBowHeight) ??
            0.35;
        const direction = end === 'front' ? 1 : -1;
        const left = (t: number) => ring[2 * GIRTH - t];
        const right = (t: number) => ring[t];
        const topRow = (c: number) => ring[2 * GIRTH - ROW.belt - c];
        const bottom = (c: number) =>
            left(0)
                .clone()
                .lerp(right(0), c / columns);

        const grid: number[][] = [];

        for (let t = 0; t <= sideRows; t++) {
            const row: number[] = [];

            for (let c = 0; c <= columns; c++) {
                if (t === sideRows) {
                    row.push(index(s, 2 * GIRTH - ROW.belt - c));
                    continue;
                }

                if (c === 0) {
                    row.push(index(s, 2 * GIRTH - t));
                    continue;
                }

                if (c === columns) {
                    row.push(index(s, t));
                    continue;
                }

                const u = c / columns;
                const v = t / sideRows;
                const point = new THREE.Vector3()
                    .addScaledVector(left(t), 1 - u)
                    .addScaledVector(right(t), u)
                    .addScaledVector(bottom(c), 1 - v)
                    .addScaledVector(topRow(c), v)
                    .addScaledVector(left(0), -(1 - u) * (1 - v))
                    .addScaledVector(right(0), -u * (1 - v))
                    .addScaledVector(left(sideRows), -(1 - u) * v)
                    .addScaledVector(right(sideRows), -u * v);

                // Bulge out most at the chosen height and in the middle.
                const across = Math.sin(Math.PI * u);
                const up =
                    v <= peak
                        ? 0.55 + 0.45 * Math.sin((Math.PI / 2) * (v / peak))
                        : Math.cos((Math.PI / 2) * ((v - peak) / (1 - peak)));
                point.x += direction * bow * Math.pow(across, 0.6) * up;

                const girth =
                    t +
                    (GIRTH - ROW.belt - Math.abs(c - columns / 2)) *
                        (t / sideRows);
                row.push(push(point, girth, direction));
            }

            grid.push(row);
        }

        for (let t = 0; t < sideRows; t++) {
            for (let c = 0; c < columns; c++) {
                const quad =
                    end === 'front'
                        ? [
                              grid[t][c],
                              grid[t + 1][c],
                              grid[t + 1][c + 1],
                              grid[t][c + 1],
                          ]
                        : [
                              grid[t][c],
                              grid[t][c + 1],
                              grid[t + 1][c + 1],
                              grid[t + 1][c],
                          ];
                cage.faces.push(quad);
                cage.materials.push(0);
            }
        }
    }

    return { cage, stations };
}

export function buildBodyShell(design: BodyDesign, levels?: number): BodyShell {
    const lines = resolveLines(design);
    const { cage, stations } = buildBodyCage(design, lines);
    const refined = subdivideQuads(cage, levels ?? design.levels ?? 3);

    return {
        design,
        surface: surfaceFromQuads(refined),
        stations,
        lines,
    };
}
