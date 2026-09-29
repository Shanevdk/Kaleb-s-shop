import * as THREE from 'three';
import type { Cage, RefinedQuads } from '@/lib/three/subdivide';

/**
 * A triangulated surface that can be cut into regions.
 *
 * Every vertex keeps its normal and the design coordinates it was refined
 * with, so a window, a lamp or a wheel arch can be described as a shape in
 * those coordinates and cut out exactly along its edge, however the
 * triangles happen to fall.
 */
export type Surface = {
    positions: number[];
    normals: number[];
    attributes: number[];
    attributeSize: number;
    triangles: number[];
    /** Material slot per triangle; -1 means cut away. */
    materials: number[];
    /** Bumped on every cut, so cached lookups know to start again. */
    revision?: number;
};

/**
 * What a region test gets to look at for one vertex.
 */
export type SurfacePoint = {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    attributes: number[];
};

export type Polyline = {
    points: THREE.Vector3[];
    normals: THREE.Vector3[];
    closed: boolean;
};

/**
 * Split each quad of a refined cage into two triangles along its shorter
 * diagonal and give every vertex an area-weighted normal.
 */
export function surfaceFromCage(cage: Cage): Surface {
    const positions = cage.positions.slice();
    const triangles: number[] = [];
    const materials: number[] = [];
    const P = positions;
    const distance = (a: number, b: number) =>
        (P[a * 3] - P[b * 3]) ** 2 +
        (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 +
        (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;

    cage.faces.forEach((face, f) => {
        const material = cage.materials[f];

        if (face.length === 3) {
            triangles.push(face[0], face[1], face[2]);
            materials.push(material);
        } else if (face.length === 4) {
            const [a, b, c, d] = face;

            if (distance(a, c) <= distance(b, d)) {
                triangles.push(a, b, c, a, c, d);
            } else {
                triangles.push(a, b, d, b, c, d);
            }

            materials.push(material, material);
        } else {
            for (let i = 1; i < face.length - 1; i++) {
                triangles.push(face[0], face[i], face[i + 1]);
                materials.push(material);
            }
        }
    });

    const surface: Surface = {
        positions,
        normals: [],
        attributes: cage.attributes.slice(),
        attributeSize: cage.attributeSize,
        triangles,
        materials,
    };
    surface.normals = vertexNormals(surface);

    return surface;
}

/**
 * The same as {@link surfaceFromCage} for a cage already refined to quads.
 */
export function surfaceFromQuads(refined: RefinedQuads): Surface {
    const P = refined.positions;
    const Q = refined.quads;
    const count = Q.length / 4;
    const triangles: number[] = [];
    const materials: number[] = [];
    const distance = (a: number, b: number) =>
        (P[a * 3] - P[b * 3]) ** 2 +
        (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 +
        (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;

    for (let q = 0; q < count; q++) {
        const a = Q[q * 4];
        const b = Q[q * 4 + 1];
        const c = Q[q * 4 + 2];
        const d = Q[q * 4 + 3];

        if (distance(a, c) <= distance(b, d)) {
            triangles.push(a, b, c, a, c, d);
        } else {
            triangles.push(a, b, d, b, c, d);
        }

        materials.push(refined.materials[q], refined.materials[q]);
    }

    const surface: Surface = {
        positions: Array.from(P),
        normals: [],
        attributes: Array.from(refined.attributes),
        attributeSize: refined.attributeSize,
        triangles,
        materials,
    };
    surface.normals = vertexNormals(surface);

    return surface;
}

export function vertexNormals(surface: Surface): number[] {
    const P = surface.positions;
    const N = new Float64Array(P.length);
    const T = surface.triangles;

    for (let t = 0; t < T.length; t += 3) {
        const a = T[t] * 3;
        const b = T[t + 1] * 3;
        const c = T[t + 2] * 3;
        const abx = P[b] - P[a];
        const aby = P[b + 1] - P[a + 1];
        const abz = P[b + 2] - P[a + 2];
        const acx = P[c] - P[a];
        const acy = P[c + 1] - P[a + 1];
        const acz = P[c + 2] - P[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        for (const v of [a, b, c]) {
            N[v] += nx;
            N[v + 1] += ny;
            N[v + 2] += nz;
        }
    }

    for (let i = 0; i < N.length; i += 3) {
        const length = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
        N[i] /= length;
        N[i + 1] /= length;
        N[i + 2] /= length;
    }

    return Array.from(N);
}

function pointAt(
    surface: Surface,
    v: number,
    target: SurfacePoint,
): SurfacePoint {
    const k = surface.attributeSize;
    target.position.set(
        surface.positions[v * 3],
        surface.positions[v * 3 + 1],
        surface.positions[v * 3 + 2],
    );
    target.normal.set(
        surface.normals[v * 3],
        surface.normals[v * 3 + 1],
        surface.normals[v * 3 + 2],
    );

    for (let c = 0; c < k; c++) {
        target.attributes[c] = surface.attributes[v * k + c];
    }

    return target;
}

function blankPoint(size: number): SurfacePoint {
    return {
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        attributes: Array.from({ length: size }, () => 0),
    };
}

/**
 * Evaluate a signed distance at every vertex: negative inside the region.
 */
function evaluate(
    surface: Surface,
    distance: (point: SurfacePoint) => number,
    bounds?: THREE.Box3,
): Float64Array {
    const count = surface.positions.length / 3;
    const values = new Float64Array(count);
    const point = blankPoint(surface.attributeSize);
    const P = surface.positions;

    for (let v = 0; v < count; v++) {
        if (
            bounds &&
            (P[v * 3] < bounds.min.x ||
                P[v * 3] > bounds.max.x ||
                P[v * 3 + 1] < bounds.min.y ||
                P[v * 3 + 1] > bounds.max.y ||
                P[v * 3 + 2] < bounds.min.z ||
                P[v * 3 + 2] > bounds.max.z)
        ) {
            values[v] = 1;
            continue;
        }

        const value = distance(pointAt(surface, v, point));
        // Nothing sits exactly on the edge, so no sliver triangles appear.
        values[v] = value === 0 ? 1e-9 : value;
    }

    return values;
}

/**
 * Cut the surface along the zero line of a signed distance.
 *
 * Triangles that straddle the line are split exactly on it, sharing the
 * new vertices with their neighbours so the cut edge is continuous. Each
 * piece then gets its material from `assign`, which is told the piece's
 * current material and whether it is inside; returning -1 removes it.
 * Outside `bounds`, when given, everything counts as outside without the
 * distance being asked.
 */
export function clipSurface(
    surface: Surface,
    distance: (point: SurfacePoint) => number,
    assign: (material: number, inside: boolean) => number,
    bounds?: THREE.Box3,
): Surface {
    // The surface is cut in place: untouched triangles keep their slot,
    // split ones are replaced by their first piece and the rest appended.
    const values = evaluate(surface, distance, bounds);
    const k = surface.attributeSize;
    const { positions, normals, attributes } = surface;
    const T = surface.triangles;
    const M = surface.materials;
    const crossings = new Map<number, number>();
    const scale = 4194304;

    const crossing = (a: number, b: number): number => {
        const key = a < b ? a * scale + b : b * scale + a;
        const existing = crossings.get(key);

        if (existing !== undefined) {
            return existing;
        }

        const t = values[a] / (values[a] - values[b]);
        const index = positions.length / 3;

        for (let c = 0; c < 3; c++) {
            positions.push(
                positions[a * 3 + c] +
                    (positions[b * 3 + c] - positions[a * 3 + c]) * t,
            );
        }

        const nx = normals[a * 3] + (normals[b * 3] - normals[a * 3]) * t;
        const ny =
            normals[a * 3 + 1] + (normals[b * 3 + 1] - normals[a * 3 + 1]) * t;
        const nz =
            normals[a * 3 + 2] + (normals[b * 3 + 2] - normals[a * 3 + 2]) * t;
        const length = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / length, ny / length, nz / length);

        for (let c = 0; c < k; c++) {
            attributes.push(
                attributes[a * k + c] +
                    (attributes[b * k + c] - attributes[a * k + c]) * t,
            );
        }

        crossings.set(key, index);

        return index;
    };

    const count = T.length;
    // Most triangles keep their material; remember the last answer.
    let lastMaterial = -2;
    let lastInside = false;
    let lastResult = -1;

    for (let t = 0; t < count; t += 3) {
        const slot = t / 3;
        const material = M[slot];

        if (material < 0) {
            continue;
        }

        const a0 = T[t];
        const b0 = T[t + 1];
        const c0 = T[t + 2];
        const ia = values[a0] < 0;

        if (ia === values[b0] < 0 && ia === values[c0] < 0) {
            if (material !== lastMaterial || ia !== lastInside) {
                lastMaterial = material;
                lastInside = ia;
                lastResult = assign(material, ia);
            }

            M[slot] = lastResult;

            continue;
        }

        const corners = [a0, b0, c0];
        const inside = [ia, values[b0] < 0, values[c0] < 0];
        const inPolygon: number[] = [];
        const outPolygon: number[] = [];

        for (let i = 0; i < 3; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 3];
            (inside[i] ? inPolygon : outPolygon).push(a);

            if (inside[i] !== inside[(i + 1) % 3]) {
                const x = crossing(a, b);
                inPolygon.push(x);
                outPolygon.push(x);
            }
        }

        let replaced = false;

        for (const [polygon, isInside] of [
            [inPolygon, true],
            [outPolygon, false],
        ] as [number[], boolean][]) {
            const next = assign(material, isInside);

            if (next < 0 || polygon.length < 3) {
                continue;
            }

            for (let i = 1; i < polygon.length - 1; i++) {
                if (!replaced) {
                    T[t] = polygon[0];
                    T[t + 1] = polygon[i];
                    T[t + 2] = polygon[i + 1];
                    M[slot] = next;
                    replaced = true;
                } else {
                    T.push(polygon[0], polygon[i], polygon[i + 1]);
                    M.push(next);
                }
            }
        }

        if (!replaced) {
            M[slot] = -1;
        }
    }

    surface.revision = (surface.revision ?? 0) + 1;

    return surface;
}

/**
 * Change the material of whole triangles that pass a test, without
 * cutting anything. Good for regions whose edge is hidden under trim.
 */
export function paintSurface(
    surface: Surface,
    test: (point: SurfacePoint, material: number) => number,
): void {
    const point = blankPoint(surface.attributeSize);
    const centre = blankPoint(surface.attributeSize);
    const T = surface.triangles;
    const k = surface.attributeSize;

    for (let t = 0; t < T.length; t += 3) {
        const material = surface.materials[t / 3];

        if (material < 0) {
            continue;
        }

        centre.position.set(0, 0, 0);
        centre.normal.set(0, 0, 0);
        centre.attributes.fill(0);

        for (let i = 0; i < 3; i++) {
            pointAt(surface, T[t + i], point);
            centre.position.addScaledVector(point.position, 1 / 3);
            centre.normal.addScaledVector(point.normal, 1 / 3);

            for (let c = 0; c < k; c++) {
                centre.attributes[c] += point.attributes[c] / 3;
            }
        }

        centre.normal.normalize();
        surface.materials[t / 3] = test(centre, material);
    }
}

/**
 * Chain segments that share endpoints into polylines.
 */
function chain(
    segments: [number, number][],
    position: (id: number) => THREE.Vector3,
    normal: (id: number) => THREE.Vector3,
): Polyline[] {
    const links = new Map<number, number[]>();

    for (const [a, b] of segments) {
        if (a === b) {
            continue;
        }

        links.set(a, [...(links.get(a) ?? []), b]);
        links.set(b, [...(links.get(b) ?? []), a]);
    }

    const used = new Set<string>();
    const lines: Polyline[] = [];
    const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

    const walk = (start: number): number[] => {
        const path = [start];
        let current = start;
        let previous = -1;

        for (;;) {
            const next = (links.get(current) ?? []).find(
                (candidate) =>
                    candidate !== previous &&
                    !used.has(key(current, candidate)),
            );

            if (next === undefined) {
                break;
            }

            used.add(key(current, next));
            path.push(next);
            previous = current;
            current = next;

            if (current === start) {
                break;
            }
        }

        return path;
    };

    // Open ends first so every open line is walked from one end.
    const starts = [
        ...[...links.keys()].filter((id) => (links.get(id) ?? []).length === 1),
        ...links.keys(),
    ];

    for (const start of starts) {
        const remaining = (links.get(start) ?? []).some(
            (other) => !used.has(key(start, other)),
        );

        if (!remaining) {
            continue;
        }

        const path = walk(start);

        if (path.length < 2) {
            continue;
        }

        const closed = path[0] === path[path.length - 1];

        if (closed) {
            path.pop();
        }

        lines.push({
            points: path.map(position),
            normals: path.map(normal),
            closed,
        });
    }

    return lines;
}

/**
 * The zero lines of a scalar function over the surface, for shut lines
 * and other seams drawn onto a panel without cutting it.
 */
export function contours(
    surface: Surface,
    value: (point: SurfacePoint) => number,
    only?: (material: number) => boolean,
    where?: (point: SurfacePoint) => boolean,
): Polyline[] {
    const values = evaluate(surface, value);
    const P = surface.positions;
    const N = surface.normals;
    const T = surface.triangles;
    const points = new Map<number, { p: THREE.Vector3; n: THREE.Vector3 }>();
    const segments: [number, number][] = [];
    const scale = 4194304;
    const probe = blankPoint(surface.attributeSize);
    const corner = blankPoint(surface.attributeSize);
    const k = surface.attributeSize;

    const allowed = (t: number): boolean => {
        if (!where) {
            return true;
        }

        probe.position.set(0, 0, 0);
        probe.normal.set(0, 0, 0);
        probe.attributes.fill(0);

        for (let i = 0; i < 3; i++) {
            pointAt(surface, T[t + i], corner);
            probe.position.addScaledVector(corner.position, 1 / 3);
            probe.normal.addScaledVector(corner.normal, 1 / 3);

            for (let c = 0; c < k; c++) {
                probe.attributes[c] += corner.attributes[c] / 3;
            }
        }

        probe.normal.normalize();

        return where(probe);
    };

    const crossing = (a: number, b: number): number => {
        const id = a < b ? a * scale + b : b * scale + a;

        if (!points.has(id)) {
            const t = values[a] / (values[a] - values[b]);
            points.set(id, {
                p: new THREE.Vector3(
                    P[a * 3] + (P[b * 3] - P[a * 3]) * t,
                    P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t,
                    P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t,
                ),
                n: new THREE.Vector3(
                    N[a * 3] + (N[b * 3] - N[a * 3]) * t,
                    N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * t,
                    N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * t,
                ).normalize(),
            });
        }

        return id;
    };

    for (let t = 0; t < T.length; t += 3) {
        const material = surface.materials[t / 3];

        if (material < 0 || (only && !only(material))) {
            continue;
        }

        const corners = [T[t], T[t + 1], T[t + 2]];

        if (
            values[corners[0]] < 0 === values[corners[1]] < 0 &&
            values[corners[1]] < 0 === values[corners[2]] < 0
        ) {
            continue;
        }

        if (!allowed(t)) {
            continue;
        }

        const found: number[] = [];

        for (let i = 0; i < 3; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 3];

            if (values[a] < 0 !== values[b] < 0) {
                found.push(crossing(a, b));
            }
        }

        if (found.length === 2) {
            segments.push([found[0], found[1]]);
        }
    }

    return chain(
        segments,
        (id) => points.get(id)!.p.clone(),
        (id) => points.get(id)!.n.clone(),
    );
}

/**
 * The edges of a set of materials: where they meet anything else, or where
 * the surface stops.
 */
type Seam = { a: number; b: number; left: number; right: number };

const seamIndexes = new WeakMap<Surface, { revision: number; seams: Seam[] }>();

/**
 * Every edge where the material changes or the surface stops, with the
 * material either side (-1 for nothing). Worked out once per cut and
 * shared by every boundary asked for afterwards.
 */
function seamsOf(surface: Surface): Seam[] {
    const revision = surface.revision ?? 0;
    const cached = seamIndexes.get(surface);

    if (cached && cached.revision === revision) {
        return cached.seams;
    }

    // Bucket every edge under its lower vertex (a counting sort), then pair
    // up the few edges in each bucket. Much faster than hashing pairs.
    const T = surface.triangles;
    const M = surface.materials;
    const vertices = surface.positions.length / 3;
    const counts = new Int32Array(vertices + 1);

    for (let t = 0; t < T.length; t += 3) {
        if (M[t / 3] < 0) {
            continue;
        }

        for (let i = 0; i < 3; i++) {
            counts[Math.min(T[t + i], T[t + ((i + 1) % 3)]) + 1] += 1;
        }
    }

    for (let v = 1; v <= vertices; v++) {
        counts[v] += counts[v - 1];
    }

    const fill = counts.slice(0, vertices);
    const other = new Int32Array(counts[vertices]);
    const owner = new Int32Array(counts[vertices]);

    for (let t = 0; t < T.length; t += 3) {
        const material = M[t / 3];

        if (material < 0) {
            continue;
        }

        for (let i = 0; i < 3; i++) {
            const a = T[t + i];
            const b = T[t + ((i + 1) % 3)];
            const low = Math.min(a, b);
            const slot = fill[low]++;
            other[slot] = Math.max(a, b);
            owner[slot] = material;
        }
    }

    const seams: Seam[] = [];

    for (let v = 0; v < vertices; v++) {
        const start = counts[v];
        const end = counts[v + 1];

        for (let i = start; i < end; i++) {
            if (other[i] < 0) {
                continue;
            }

            let right = -1;

            for (let j = i + 1; j < end; j++) {
                if (other[j] === other[i]) {
                    right = owner[j];
                    other[j] = -1;
                    break;
                }
            }

            if (right !== owner[i]) {
                seams.push({ a: v, b: other[i], left: owner[i], right });
            }
        }
    }

    seamIndexes.set(surface, { revision, seams });

    return seams;
}

export function boundaries(
    surface: Surface,
    inside: (material: number) => boolean,
): Polyline[] {
    const segments: [number, number][] = [];

    for (const seam of seamsOf(surface)) {
        const left = inside(seam.left);
        const right = seam.right >= 0 && inside(seam.right);

        if (left !== right) {
            segments.push([seam.a, seam.b]);
        }
    }

    const P = surface.positions;
    const N = surface.normals;

    return chain(
        segments,
        (v) => new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]),
        (v) => new THREE.Vector3(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]),
    );
}

/**
 * Find where on the surface a set of design coordinates falls, by
 * searching the triangles in design space. `accept` can rule out
 * triangles, for instance those on the other side of the car.
 */
export function locate(
    surface: Surface,
    channels: [number, number],
    target: [number, number],
    accept: (centre: THREE.Vector3) => boolean = () => true,
): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
    const k = surface.attributeSize;
    const A = surface.attributes;
    const P = surface.positions;
    const N = surface.normals;
    const T = surface.triangles;
    const [cu, cv] = channels;
    const [tu, tv] = target;
    const centre = new THREE.Vector3();
    let best: { position: THREE.Vector3; normal: THREE.Vector3 } | null = null;
    let bestMiss = Infinity;

    for (let t = 0; t < T.length; t += 3) {
        if (surface.materials[t / 3] < 0) {
            continue;
        }

        const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
        const ax = A[a * k + cu];
        const ay = A[a * k + cv];
        const bx = A[b * k + cu];
        const by = A[b * k + cv];
        const cx = A[c * k + cu];
        const cy = A[c * k + cv];
        const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);

        if (Math.abs(det) < 1e-12) {
            continue;
        }

        const w1 = ((by - cy) * (tu - cx) + (cx - bx) * (tv - cy)) / det;
        const w2 = ((cy - ay) * (tu - cx) + (ax - cx) * (tv - cy)) / det;
        const w3 = 1 - w1 - w2;
        const miss = Math.max(0, -w1, -w2, -w3);

        if (miss > bestMiss || miss > 0.05) {
            continue;
        }

        centre.set(
            (P[a * 3] + P[b * 3] + P[c * 3]) / 3,
            (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3,
            (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3,
        );

        if (!accept(centre)) {
            continue;
        }

        const weights = [w1, w2, w3];
        const position = new THREE.Vector3();
        const normal = new THREE.Vector3();

        [a, b, c].forEach((v, i) => {
            position.x += P[v * 3] * weights[i];
            position.y += P[v * 3 + 1] * weights[i];
            position.z += P[v * 3 + 2] * weights[i];
            normal.x += N[v * 3] * weights[i];
            normal.y += N[v * 3 + 1] * weights[i];
            normal.z += N[v * 3 + 2] * weights[i];
        });

        best = { position, normal: normal.normalize() };
        bestMiss = miss;

        if (miss === 0) {
            break;
        }
    }

    return best;
}

export type SurfaceHit = {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    distance: number;
};

type RayGrid = {
    axes: [number, number];
    min: [number, number];
    cell: number;
    columns: number;
    rows: number;
    buckets: number[][];
};

const rayGrids = new WeakMap<
    Surface,
    { revision: number; grids: Map<number, RayGrid> }
>();

/**
 * Bucket the triangles by where they fall when looked at along one axis,
 * so rays along that axis only test the few triangles in their bucket.
 */
function rayGrid(surface: Surface, axis: number): RayGrid {
    const revision = surface.revision ?? 0;
    let cache = rayGrids.get(surface);

    // A cut since the grids were made invalidates them.
    if (!cache || cache.revision !== revision) {
        cache = { revision, grids: new Map() };
        rayGrids.set(surface, cache);
    }

    const grids = cache.grids;
    const existing = grids.get(axis);

    if (existing) {
        return existing;
    }

    const axes: [number, number] =
        axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const P = surface.positions;
    const T = surface.triangles;
    const min: [number, number] = [Infinity, Infinity];
    const max: [number, number] = [-Infinity, -Infinity];

    for (let v = 0; v < P.length; v += 3) {
        for (let i = 0; i < 2; i++) {
            min[i] = Math.min(min[i], P[v + axes[i]]);
            max[i] = Math.max(max[i], P[v + axes[i]]);
        }
    }

    const cell = Math.max(
        0.02,
        Math.max(max[0] - min[0], max[1] - min[1]) / 96,
    );
    const columns = Math.max(1, Math.ceil((max[0] - min[0]) / cell) + 1);
    const rows = Math.max(1, Math.ceil((max[1] - min[1]) / cell) + 1);
    const buckets: number[][] = Array.from(
        { length: columns * rows },
        () => [],
    );

    for (let t = 0; t < T.length; t += 3) {
        if (surface.materials[t / 3] < 0) {
            continue;
        }

        let u0 = Infinity;
        let u1 = -Infinity;
        let v0 = Infinity;
        let v1 = -Infinity;

        for (let i = 0; i < 3; i++) {
            const p = T[t + i] * 3;
            u0 = Math.min(u0, P[p + axes[0]]);
            u1 = Math.max(u1, P[p + axes[0]]);
            v0 = Math.min(v0, P[p + axes[1]]);
            v1 = Math.max(v1, P[p + axes[1]]);
        }

        const c0 = Math.floor((u0 - min[0]) / cell);
        const c1 = Math.floor((u1 - min[0]) / cell);
        const r0 = Math.floor((v0 - min[1]) / cell);
        const r1 = Math.floor((v1 - min[1]) / cell);

        for (let c = c0; c <= c1; c++) {
            for (let r = r0; r <= r1; r++) {
                buckets[r * columns + c].push(t);
            }
        }
    }

    const grid = { axes, min, cell, columns, rows, buckets };
    grids.set(axis, grid);

    return grid;
}

/**
 * The nearest place a ray hits the surface, with the surface normal there.
 * Rays along an axis use a bucket grid; others test every triangle.
 */
export function raycastSurface(
    surface: Surface,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
): SurfaceHit | null {
    const P = surface.positions;
    const N = surface.normals;
    const T = surface.triangles;
    const dir = direction.clone().normalize();
    let best = Infinity;
    let hit: SurfaceHit | null = null;
    const components = [dir.x, dir.y, dir.z];
    const axis = components.findIndex((c) => Math.abs(c) > 0.9999);
    let candidates: number[] | null = null;

    if (axis >= 0) {
        const grid = rayGrid(surface, axis);
        const o = [origin.x, origin.y, origin.z];
        const c = Math.floor((o[grid.axes[0]] - grid.min[0]) / grid.cell);
        const r = Math.floor((o[grid.axes[1]] - grid.min[1]) / grid.cell);
        candidates =
            c >= 0 && r >= 0 && c < grid.columns && r < grid.rows
                ? grid.buckets[r * grid.columns + c]
                : [];
    }

    const count = candidates ? candidates.length : T.length / 3;

    for (let n = 0; n < count; n++) {
        const t = candidates ? candidates[n] : n * 3;

        if (surface.materials[t / 3] < 0) {
            continue;
        }

        const a = T[t] * 3;
        const b = T[t + 1] * 3;
        const c = T[t + 2] * 3;
        const e1x = P[b] - P[a];
        const e1y = P[b + 1] - P[a + 1];
        const e1z = P[b + 2] - P[a + 2];
        const e2x = P[c] - P[a];
        const e2y = P[c + 1] - P[a + 1];
        const e2z = P[c + 2] - P[a + 2];
        const px = dir.y * e2z - dir.z * e2y;
        const py = dir.z * e2x - dir.x * e2z;
        const pz = dir.x * e2y - dir.y * e2x;
        const det = e1x * px + e1y * py + e1z * pz;

        if (Math.abs(det) < 1e-12) {
            continue;
        }

        const inv = 1 / det;
        const tx = origin.x - P[a];
        const ty = origin.y - P[a + 1];
        const tz = origin.z - P[a + 2];
        const u = (tx * px + ty * py + tz * pz) * inv;

        if (u < 0 || u > 1) {
            continue;
        }

        const qx = ty * e1z - tz * e1y;
        const qy = tz * e1x - tx * e1z;
        const qz = tx * e1y - ty * e1x;
        const v = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;

        if (v < 0 || u + v > 1) {
            continue;
        }

        const distance = (e2x * qx + e2y * qy + e2z * qz) * inv;

        if (distance > 1e-6 && distance < best) {
            best = distance;
            const w = 1 - u - v;
            hit = {
                position: origin.clone().addScaledVector(dir, distance),
                normal: new THREE.Vector3(
                    N[a] * w + N[b] * u + N[c] * v,
                    N[a + 1] * w + N[b + 1] * u + N[c + 1] * v,
                    N[a + 2] * w + N[b + 2] * u + N[c + 2] * v,
                ).normalize(),
                distance,
            };
        }
    }

    return hit;
}

/**
 * Build one geometry per material slot. Each slot gets its own copy of the
 * vertices on its edges, so a slot can be pushed in or out along the
 * normals (glass set back from its frame) without dragging its neighbours.
 */
export function surfaceGeometries(
    surface: Surface,
    offsets: Record<number, number> = {},
): Map<number, THREE.BufferGeometry> {
    const bySlot = new Map<number, number[]>();
    const T = surface.triangles;

    for (let t = 0; t < T.length; t += 3) {
        const material = surface.materials[t / 3];

        if (material < 0) {
            continue;
        }

        const list = bySlot.get(material) ?? [];
        list.push(T[t], T[t + 1], T[t + 2]);
        bySlot.set(material, list);
    }

    const geometries = new Map<number, THREE.BufferGeometry>();
    const P = surface.positions;
    const N = surface.normals;

    for (const [slot, indices] of bySlot) {
        const remap = new Map<number, number>();
        const positions: number[] = [];
        const normals: number[] = [];
        const index: number[] = [];
        const offset = offsets[slot] ?? 0;

        for (const v of indices) {
            let local = remap.get(v);

            if (local === undefined) {
                local = positions.length / 3;
                remap.set(v, local);
                positions.push(
                    P[v * 3] + N[v * 3] * offset,
                    P[v * 3 + 1] + N[v * 3 + 1] * offset,
                    P[v * 3 + 2] + N[v * 3 + 2] * offset,
                );
                normals.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
            }

            index.push(local);
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
        geometry.setIndex(index);
        geometries.set(slot, geometry);
    }

    return geometries;
}
