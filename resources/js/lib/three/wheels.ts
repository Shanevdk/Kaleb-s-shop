import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { polygonDistance, roundPolygon } from '@/lib/three/curves';
import type { Materials } from '@/lib/three/materials';
import { clonePatched } from '@/lib/three/shading';
import {
    boltGeometry,
    box,
    cyl,
    instanced,
    lathe,
    place,
    puck,
    torus,
    type Point,
    type Transform,
} from '@/lib/three/shapes';
import {
    boundaries,
    clipSurface,
    surfaceGeometries,
    vertexNormals,
    type Surface,
} from '@/lib/three/surface';
import { sidewallTexture, treadTexture } from '@/lib/three/textures';

export type Tread =
    | 'road'
    | 'highway'
    | 'allTerrain'
    | 'mud'
    | 'truck'
    | 'tractor'
    | 'turf'
    | 'moto'
    | 'knobby'
    | 'trailer';

/**
 * A tyre as written on its sidewall: 235/45 R18 is a width of 0.235 m, an
 * aspect of 0.45 and an 18 inch rim.
 */
export type TyreSpec = {
    width: number;
    aspect: number;
    rim: number;
    tread: Tread;
    /** Extra sidewall marking, such as M+S or LT. */
    label?: string;
};

export type RimStyle =
    | 'split5'
    | 'spoke6'
    | 'mesh10'
    | 'steel'
    | 'truck'
    | 'moto'
    | 'atv'
    | 'tractor'
    | 'trailer';

export type WheelSpec = {
    tyre: TyreSpec;
    rim: RimStyle;
    studs?: number;
    brake?: 'disc' | 'drum' | 'none';
    caliper?: THREE.Material;
    /** Twin tyres side by side, as on a truck's drive axle. */
    dual?: boolean;
    /** Paint the rim this instead of its usual finish. */
    rimMaterial?: THREE.Material;
};

export function rimRadius(tyre: TyreSpec): number {
    return (tyre.rim * 0.0254) / 2;
}

export function tyreRadius(tyre: TyreSpec): number {
    return rimRadius(tyre) + tyre.width * tyre.aspect;
}

/**
 * Space the points of a profile evenly along its length, so a texture laid
 * down it is not squashed where the points bunch up.
 */
function resample(points: Point[], count: number): Point[] {
    const lengths = [0];

    for (let i = 1; i < points.length; i++) {
        lengths.push(
            lengths[i - 1] +
                Math.hypot(
                    points[i][0] - points[i - 1][0],
                    points[i][1] - points[i - 1][1],
                ),
        );
    }

    const total = lengths[lengths.length - 1];
    const result: Point[] = [];
    let segment = 1;

    for (let i = 0; i < count; i++) {
        const target = (total * i) / (count - 1);

        while (segment < points.length - 1 && lengths[segment] < target) {
            segment += 1;
        }

        const span = lengths[segment] - lengths[segment - 1] || 1;
        const t = Math.min(
            1,
            Math.max(0, (target - lengths[segment - 1]) / span),
        );
        result.push([
            points[segment - 1][0] +
                (points[segment][0] - points[segment - 1][0]) * t,
            points[segment - 1][1] +
                (points[segment][1] - points[segment - 1][1]) * t,
        ]);
    }

    return result;
}

/**
 * A tyre, built round the Z axis in the XY plane with its outer wall
 * facing +Z. The walls bulge past the rim and carry a rim protector rib,
 * the shoulders are rounded, and the tread is either grooved and siped
 * (road tyres) or made of real blocks standing off the carcass.
 */
export function buildTyre(m: Materials, spec: TyreSpec): THREE.Group {
    const group = new THREE.Group();
    const Rr = rimRadius(spec);
    const W = spec.width;
    const H = W * spec.aspect;
    const R = Rr + H;
    const moto = spec.tread === 'moto' || spec.tread === 'knobby';
    const Wr = W * (moto ? 0.72 : 0.8);
    const depth =
        spec.tread === 'tractor'
            ? H * 0.2
            : spec.tread === 'mud'
              ? 0.02
              : spec.tread === 'knobby'
                ? Math.max(0.01, H * 0.08)
                : spec.tread === 'allTerrain'
                  ? 0.013
                  : 0;
    const Rc = R - depth;
    const s = moto ? W * 0.42 : Math.min(0.03, W * 0.13, H * 0.3);
    const bulge = Math.min(0.012, W * 0.04);

    const wall = (sign: 1 | -1): Point[] => {
        const points: Point[] = [];

        for (let i = 0; i <= 6; i++) {
            const a = (Math.PI / 2) * (i / 6);
            points.push([
                Rc - s + s * Math.cos(a),
                sign * (W / 2 - s + s * Math.sin(a)),
            ]);
        }

        points.push([Rr + H * 0.62, sign * (W / 2 + bulge * 0.4)]);
        points.push([Rr + H * 0.42, sign * (W / 2 + bulge * 0.5)]);
        points.push([Rr + H * 0.22, sign * (W / 2 + bulge * 0.1)]);
        points.push([Rr + Math.min(0.05, H * 0.3), sign * (Wr / 2 + 0.024)]);
        points.push([Rr + Math.min(0.033, H * 0.22), sign * (Wr / 2 + 0.027)]);
        points.push([Rr + 0.018, sign * (Wr / 2 + 0.018)]);
        points.push([Rr + 0.004, sign * (Wr / 2 + 0.006)]);

        return resample(points, 28);
    };

    const segments = 96;
    const outerWall = lathe(wall(1), m.tyre, 'z', 0, 0, 0, segments);
    const innerWall = lathe(wall(-1).reverse(), m.tyre, 'z', 0, 0, 0, segments);
    group.add(outerWall, innerWall);

    const size = `${Math.round(W * 1000)}/${Math.round(spec.aspect * 100)} R${spec.rim}`;
    const marking = sidewallTexture(
        size,
        spec.label ?? (spec.tread === 'road' ? '94W  XL' : 'M+S  LT'),
    );

    if (marking) {
        const material = clonePatched(m.tyre);
        material.bumpMap = marking;
        material.bumpScale = 3;
        outerWall.material = material;
    }

    // The tread face, grooved for road patterns.
    const tread: Point[] = [];
    const half = W / 2 - s;
    const grooves: number[] =
        spec.tread === 'road' || spec.tread === 'highway'
            ? [-0.31, -0.1, 0.1, 0.31]
            : spec.tread === 'truck' || spec.tread === 'trailer'
              ? [-0.3, -0.12, 0.12, 0.3]
              : moto
                ? []
                : [];
    const grooveWidth = Math.min(0.012, W * 0.05);
    const grooveDepth = 0.008;
    const crowned = (y: number) =>
        moto
            ? Rc - Math.pow(Math.abs(y) / (W / 2), 2) * s * 0.3
            : Rc - Math.pow(Math.abs(y) / half, 4) * 0.003;

    tread.push([crowned(-half), -half]);

    for (const g of grooves) {
        const y = g * W;
        tread.push([crowned(y - grooveWidth), y - grooveWidth]);
        tread.push([crowned(y) - grooveDepth, y - grooveWidth * 0.6]);
        tread.push([crowned(y) - grooveDepth, y + grooveWidth * 0.6]);
        tread.push([crowned(y + grooveWidth), y + grooveWidth]);
    }

    tread.push([crowned(half), half]);

    const detailed = grooves.length > 0 ? tread : resample(tread, 16);
    const face = lathe(detailed, m.tyre, 'z', 0, 0, 0, segments * 2);
    const sipes =
        spec.tread === 'road' ||
        spec.tread === 'highway' ||
        spec.tread === 'truck' ||
        spec.tread === 'trailer'
            ? treadTexture(
                  spec.tread === 'truck' || spec.tread === 'trailer'
                      ? 'truck'
                      : 'road',
              )
            : spec.tread === 'turf'
              ? treadTexture('turf')
              : null;

    if (sipes) {
        const material = clonePatched(m.tyre);
        material.bumpMap = sipes.clone();
        material.bumpMap.needsUpdate = true;
        material.bumpMap.repeat.set(Math.round((Math.PI * 2 * R) / 0.034), 1);
        material.bumpScale = 2.5;
        face.material = material;
    }

    group.add(face);

    if (depth > 0) {
        group.add(treadBlocks(m, spec, Rc, W, depth, s));
    }

    return group;
}

/**
 * Tread blocks for off-road, agricultural and dirt tyres, laid round the
 * carcass pitch by pitch.
 */
function treadBlocks(
    m: Materials,
    spec: TyreSpec,
    Rc: number,
    W: number,
    depth: number,
    shoulder: number,
): THREE.Object3D {
    const group = new THREE.Group();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, 'ZYX');
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);

    type Block = {
        angle: number;
        axial: number;
        length: number;
        width: number;
        tilt?: number;
        lift?: number;
    };

    const add = (blocks: Block[], height: number, rounding: number) => {
        const geometry = new RoundedBoxGeometry(1, 1, 1, 1, rounding);
        const mesh = new THREE.InstancedMesh(geometry, m.tyre, blocks.length);

        blocks.forEach((block, i) => {
            const r = Rc + height / 2 - 0.001 + (block.lift ?? 0);
            position.set(
                Math.cos(block.angle) * r,
                Math.sin(block.angle) * r,
                block.axial,
            );
            euler.set(block.tilt ?? 0, 0, block.angle);
            quaternion.setFromEuler(euler);
            scale.set(height, block.length, block.width);
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(i, matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    };

    const circumference = Math.PI * 2 * Rc;

    if (spec.tread === 'tractor') {
        // Chevron bars, alternating from each shoulder towards the middle.
        const pitches = Math.round(circumference / 0.26);
        const bars: Block[] = [];

        for (let p = 0; p < pitches; p++) {
            for (const side of [1, -1]) {
                const angle =
                    ((p + (side > 0 ? 0 : 0.5)) / pitches) * Math.PI * 2;
                bars.push({
                    angle: angle + side * 0.035,
                    axial: side * W * 0.25,
                    length: W * 0.62,
                    width: 0.06,
                    tilt: side * 0.85,
                });
            }
        }

        // RoundedBox is unit sized, so the length is along Y and the tilt
        // swings it towards the axle.
        add(
            bars.map((bar) => ({ ...bar, length: 0.06, width: bar.length })),
            depth,
            0.08,
        );

        return group;
    }

    const knobby = spec.tread === 'knobby';
    const mud = spec.tread === 'mud';
    const pitch = knobby ? 0.06 : mud ? 0.1 : 0.072;
    const pitches = Math.round(circumference / pitch);
    const step = (Math.PI * 2) / pitches;
    const blocks: Block[] = [];
    const shoulders: Block[] = [];

    for (let p = 0; p < pitches; p++) {
        const angle = p * step;
        const alternate = p % 2 === 0 ? 1 : -1;

        if (knobby) {
            for (const axial of [-0.3, 0, 0.3]) {
                blocks.push({
                    angle: angle + (axial === 0 ? step / 2 : 0),
                    axial: axial * W,
                    length: step * Rc * 0.55,
                    width: W * 0.18,
                });
            }

            continue;
        }

        // Staggered centre blocks with a slight twist, as on an all-terrain.
        blocks.push({
            angle,
            axial: alternate * W * (mud ? 0.13 : 0.1),
            length: step * Rc * (mud ? 0.58 : 0.78),
            width: W * (mud ? 0.2 : 0.17),
            tilt: alternate * 0.12,
        });
        blocks.push({
            angle: angle + step * 0.5,
            axial: -alternate * W * (mud ? 0.13 : 0.1),
            length: step * Rc * (mud ? 0.58 : 0.72),
            width: W * (mud ? 0.18 : 0.15),
            tilt: -alternate * 0.12,
        });

        if (!mud) {
            for (const side of [1, -1]) {
                blocks.push({
                    angle: angle + step * 0.25 * side,
                    axial: side * W * 0.27,
                    length: step * Rc * 0.74,
                    width: W * 0.14,
                });
            }
        }

        // Shoulder blocks run over the edge onto the wall.
        for (const side of [1, -1]) {
            const offset = p % 2 === 0 ? 0 : step * 0.18;
            shoulders.push({
                angle: angle + offset,
                axial: side * (W / 2 - shoulder * 0.9),
                length: step * Rc * (mud ? 0.62 : 0.8),
                width: W * (mud ? 0.26 : 0.18),
            });
        }
    }

    add(blocks, depth, 0.14);
    add(shoulders, depth * 1.05, 0.12);

    // Lugs moulded on the upper wall.
    const lugs: Transform[] = [];

    for (let p = 0; p < pitches; p += 1) {
        if (p % 2 === 1 && !mud) {
            continue;
        }

        for (const side of [1, -1]) {
            const angle = p * step + (p % 4 === 0 ? 0 : step * 0.3);
            const r = Rc - shoulder * 0.9;
            lugs.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r,
                z: side * (W / 2 + 0.003),
                rz: angle,
            });
        }
    }

    group.add(
        instanced(
            new RoundedBoxGeometry(
                shoulder * 1.4,
                step * Rc * 0.6,
                0.01,
                1,
                0.003,
            ),
            m.tyre,
            lugs,
        ),
    );

    return group;
}

type Window = Point[];

/**
 * How far the hub sits back from the rim lip: alloys are dished, pressed
 * steel wheels push their centre out.
 */
const DISH: Record<RimStyle, number> = {
    split5: 0.045,
    spoke6: 0.04,
    mesh10: 0.05,
    moto: 0.01,
    truck: -0.03,
    tractor: 0.12,
    steel: -0.025,
    trailer: -0.025,
    atv: -0.02,
};

/**
 * The openings between the spokes of a wheel face, drawn in polar terms and
 * rounded at the corners.
 */
function spokeWindows(
    count: number,
    inner: number,
    outer: number,
    spokeAtHub: number,
    spokeAtRim: number,
    options: { twist?: number; split?: number; rounding?: number } = {},
): Window[] {
    const windows: Window[] = [];
    const steps = 10;
    const halfSpoke = (r: number) => {
        const t = (r - inner) / (outer - inner);

        return (spokeAtHub + (spokeAtRim - spokeAtHub) * t) / 2 / r;
    };
    const twist = (r: number) =>
        (options.twist ?? 0) * ((r - inner) / (outer - inner));

    for (let i = 0; i < count; i++) {
        const centre = ((i + 0.5) / count) * Math.PI * 2;
        const gap = Math.PI / count;
        const points: Point[] = [];
        const edge = (r: number, side: 1 | -1) =>
            centre + side * (gap - halfSpoke(r)) + twist(r);

        for (let s = 0; s <= steps; s++) {
            const a =
                edge(outer, -1) +
                ((edge(outer, 1) - edge(outer, -1)) * s) / steps;
            points.push([Math.cos(a) * outer, Math.sin(a) * outer]);
        }

        for (let s = 1; s < steps; s++) {
            const r = outer - ((outer - inner) * s) / steps;
            const a = edge(r, 1);
            points.push([Math.cos(a) * r, Math.sin(a) * r]);
        }

        for (let s = 0; s <= steps; s++) {
            const a =
                edge(inner, 1) +
                ((edge(inner, -1) - edge(inner, 1)) * s) / steps;
            points.push([Math.cos(a) * inner, Math.sin(a) * inner]);
        }

        for (let s = 1; s < steps; s++) {
            const r = inner + ((outer - inner) * s) / steps;
            const a = edge(r, -1);
            points.push([Math.cos(a) * r, Math.sin(a) * r]);
        }

        windows.push(
            roundPolygon(simplify(points), options.rounding ?? 0.012, 4),
        );
    }

    if (options.split) {
        // A slot down the middle of every spoke.
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const from = inner + (outer - inner) * 0.16;
            const to = outer - (outer - inner) * 0.08;
            const width = options.split;
            const points: Point[] = [];

            for (let s = 0; s <= steps; s++) {
                const r = from + ((to - from) * s) / steps;
                const w = width * (0.6 + 0.4 * (s / steps));
                const a = angle + twist(r) + w / 2 / r;
                points.push([Math.cos(a) * r, Math.sin(a) * r]);
            }

            for (let s = steps; s >= 0; s--) {
                const r = from + ((to - from) * s) / steps;
                const w = width * (0.6 + 0.4 * (s / steps));
                const a = angle + twist(r) - w / 2 / r;
                points.push([Math.cos(a) * r, Math.sin(a) * r]);
            }

            windows.push(roundPolygon(simplify(points), width * 0.45, 3));
        }
    }

    return windows;
}

function simplify(points: Point[]): Point[] {
    return points.filter(
        (p, i) =>
            i === 0 ||
            Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-4,
    );
}

function circle(radius: number, segments = 48): Point[] {
    return Array.from({ length: segments }, (_, i) => {
        const a = (i / segments) * Math.PI * 2;

        return [Math.cos(a) * radius, Math.sin(a) * radius] as Point;
    });
}

/**
 * A wheel face: a dense disc with its openings cut out exactly, dished so
 * the hub sits back from the rim (or forward, for a steel wheel's pressed
 * centre), with walls down every cut edge. The front takes the face
 * finish and the walls the pocket finish, as on a diamond-cut alloy.
 */
function wheelFace(
    outer: number,
    holes: Window[],
    thickness: number,
    dish: number,
    hubRadius: number,
    materials: [THREE.Material, THREE.Material],
    bore = 0.03,
): THREE.Group {
    const rings = 30;
    const sectors = 200;
    const radii = Array.from({ length: rings }, (_, i) => {
        const t = i / (rings - 1);

        return bore + (outer - bore) * (1 - Math.pow(1 - t, 1.25));
    });
    let surface: Surface = {
        positions: [],
        normals: [],
        attributes: [],
        attributeSize: 0,
        triangles: [],
        materials: [],
    };

    for (const r of radii) {
        for (let j = 0; j < sectors; j++) {
            const a = (j / sectors) * Math.PI * 2;
            surface.positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
            surface.normals.push(0, 0, 1);
        }
    }

    for (let i = 0; i < rings - 1; i++) {
        for (let j = 0; j < sectors; j++) {
            const a = i * sectors + j;
            const b = i * sectors + ((j + 1) % sectors);
            const c = (i + 1) * sectors + ((j + 1) % sectors);
            const d = (i + 1) * sectors + j;
            surface.triangles.push(a, c, b, a, d, c);
            surface.materials.push(0, 0);
        }
    }

    // One cut for every opening at once, only measuring the distance to an
    // opening near enough to matter.
    const margin = 0.02;
    const boxes = holes.map((window) => {
        const xs = window.map(([x]) => x);
        const ys = window.map(([, y]) => y);

        return [
            Math.min(...xs) - margin,
            Math.max(...xs) + margin,
            Math.min(...ys) - margin,
            Math.max(...ys) + margin,
        ];
    });
    const openings = (x: number, y: number): number => {
        let best = margin;

        for (let i = 0; i < holes.length; i++) {
            const [x0, x1, y0, y1] = boxes[i];

            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
                best = Math.min(best, polygonDistance(x, y, holes[i]));
            }
        }

        return best;
    };

    surface = clipSurface(
        surface,
        (point) => openings(point.position.x, point.position.y),
        (material, inside) => (inside ? -1 : material),
    );

    const height = (r: number) => {
        const t = Math.min(
            1,
            Math.max(0, (r - hubRadius) / (outer - hubRadius)),
        );
        // Spokes run straight out, then curl forward to meet the lip.
        const curve = 1 - Math.pow(1 - t, 1.6);

        return -dish * (1 - curve);
    };
    const P = surface.positions;

    for (let v = 0; v < P.length; v += 3) {
        P[v + 2] = height(Math.hypot(P[v], P[v + 1])) + thickness / 2;
    }

    surface.normals = vertexNormals(surface);
    const front = surfaceGeometries(surface).get(0)!;

    for (let v = 0; v < P.length; v += 3) {
        P[v + 2] -= thickness;
    }

    const back = surfaceGeometries(surface).get(0)!;
    const index = back.index!;

    for (let i = 0; i < index.count; i += 3) {
        const swap = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, swap);
    }

    back.computeVertexNormals();

    // Walls down every edge, facing away from the metal.
    const solid = (x: number, y: number) => {
        const r = Math.hypot(x, y);

        return r > bore && r < outer && openings(x, y) > 0;
    };
    const positions: number[] = [];
    const normals: number[] = [];

    for (const line of boundaries(surface, () => true)) {
        const points = line.points;
        const count = points.length;
        const segments = line.closed ? count : count - 1;

        for (let i = 0; i < segments; i++) {
            const a = points[i];
            const b = points[(i + 1) % count];
            let nx = b.y - a.y;
            let ny = -(b.x - a.x);
            const length = Math.hypot(nx, ny) || 1;
            nx /= length;
            ny /= length;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;

            if (solid(mx + nx * 0.002, my + ny * 0.002)) {
                nx = -nx;
                ny = -ny;
            }

            const top = (p: THREE.Vector3) =>
                height(Math.hypot(p.x, p.y)) + thickness / 2;
            const quad = [
                [a.x, a.y, top(a)],
                [b.x, b.y, top(b)],
                [b.x, b.y, top(b) - thickness],
                [a.x, a.y, top(a) - thickness],
            ];
            // Wind so the face looks out along the wall normal.
            const ux = quad[1][0] - quad[0][0];
            const uy = quad[1][1] - quad[0][1];
            const uz = quad[1][2] - quad[0][2];
            const wx = quad[3][0] - quad[0][0];
            const wy = quad[3][1] - quad[0][1];
            const wz = quad[3][2] - quad[0][2];
            const cx = uy * wz - uz * wy;
            const cy = uz * wx - ux * wz;
            const order =
                cx * nx + cy * ny > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];

            for (const k of order) {
                positions.push(...quad[k]);
                normals.push(nx, ny, 0);
            }
        }
    }

    const walls = new THREE.BufferGeometry();
    walls.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    walls.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

    const group = new THREE.Group();
    group.add(
        place(new THREE.Mesh(front, materials[0])),
        place(new THREE.Mesh(back, materials[1])),
        place(new THREE.Mesh(walls, materials[1])),
    );

    return group;
}

/**
 * A rim: the hoop the tyre sits on, the face with its spokes, the hub and
 * nuts, and a centre cap. Built round Z with the face towards +Z.
 */
export function buildRim(m: Materials, spec: WheelSpec): THREE.Group {
    const group = new THREE.Group();
    const Rr = rimRadius(spec.tyre);
    const W = spec.tyre.width;
    const moto = spec.rim === 'moto';
    const Wr = W * (moto ? 0.72 : 0.8);
    const style = spec.rim;
    const alloy =
        style === 'split5' ||
        style === 'spoke6' ||
        style === 'mesh10' ||
        style === 'moto';
    const faceMaterial = spec.rimMaterial ?? (alloy ? m.alloy : m.steelWheel);
    const sideMaterial =
        spec.rimMaterial ?? (alloy ? m.alloyPaint : m.steelWheel);
    const lip = Rr + 0.014;

    // The barrel: flanges, bead seats and the drop well, seen through the
    // spokes from inside.
    const barrel: Point[] = [
        [lip, Wr / 2 + 0.003],
        [lip - 0.001, Wr / 2 - 0.004],
        [Rr + 0.002, Wr / 2 - 0.01],
        [Rr - 0.001, Wr / 2 - 0.032],
        [Rr - 0.024, Wr / 2 - 0.05],
        [Rr - 0.027, -Wr / 2 + 0.07],
        [Rr - 0.002, -Wr / 2 + 0.035],
        [Rr + 0.002, -Wr / 2 + 0.01],
        [lip - 0.001, -Wr / 2 + 0.004],
        [lip, -Wr / 2 - 0.003],
    ];
    group.add(lathe(barrel, sideMaterial, 'z', 0, 0, 0, 72));

    const faceZ = Wr / 2 - 0.018;
    const dish = DISH[style];
    const studs =
        spec.studs ?? (style === 'truck' ? 10 : style === 'atv' ? 4 : 5);
    const pcd =
        style === 'truck'
            ? 0.285
            : style === 'atv'
              ? 0.11
              : style === 'tractor'
                ? 0.335
                : 0.114;
    let hubRadius = Math.max(0.055, pcd / 2 + 0.03);
    let face: THREE.Group;

    switch (style) {
        case 'split5':
        case 'spoke6':
        case 'mesh10': {
            const count = style === 'spoke6' ? 6 : style === 'mesh10' ? 10 : 5;
            const windows = spokeWindows(
                count,
                hubRadius + 0.012,
                Rr - 0.012,
                style === 'mesh10' ? 0.03 : 0.058,
                style === 'mesh10' ? 0.022 : 0.04,
                {
                    split: style === 'split5' ? 0.014 : undefined,
                    rounding: style === 'mesh10' ? 0.008 : 0.014,
                    twist: style === 'mesh10' ? 0.06 : 0,
                },
            );
            face = wheelFace(lip - 0.002, windows, 0.03, dish, hubRadius, [
                faceMaterial,
                sideMaterial,
            ]);
            break;
        }
        case 'moto': {
            hubRadius = 0.055;
            const windows = spokeWindows(5, 0.07, Rr - 0.02, 0.032, 0.022, {
                twist: 0.35,
                rounding: 0.01,
            });
            face = wheelFace(lip - 0.002, windows, 0.018, dish, hubRadius, [
                faceMaterial,
                sideMaterial,
            ]);
            break;
        }
        case 'truck': {
            const handHoles: Window[] = [];

            for (let i = 0; i < 10; i++) {
                const a = ((i + 0.5) / 10) * Math.PI * 2;
                const r = Rr * 0.66;
                handHoles.push(
                    roundPolygon(
                        [
                            [
                                Math.cos(a - 0.1) * (r - 0.03),
                                Math.sin(a - 0.1) * (r - 0.03),
                            ],
                            [
                                Math.cos(a + 0.1) * (r - 0.03),
                                Math.sin(a + 0.1) * (r - 0.03),
                            ],
                            [
                                Math.cos(a + 0.12) * (r + 0.035),
                                Math.sin(a + 0.12) * (r + 0.035),
                            ],
                            [
                                Math.cos(a - 0.12) * (r + 0.035),
                                Math.sin(a - 0.12) * (r + 0.035),
                            ],
                        ],
                        0.02,
                        4,
                    ),
                );
            }

            face = wheelFace(lip - 0.002, handHoles, 0.012, dish, hubRadius, [
                faceMaterial,
                sideMaterial,
            ]);
            break;
        }
        case 'tractor': {
            const holes: Window[] = [];

            for (let i = 0; i < 8; i++) {
                const a = ((i + 0.5) / 8) * Math.PI * 2;
                const r = (hubRadius + Rr) / 2 + 0.02;
                holes.push(
                    circle(0.045, 20).map(([x, y]) => [
                        x + Math.cos(a) * r,
                        y + Math.sin(a) * r,
                    ]),
                );
            }

            face = wheelFace(lip - 0.002, holes, 0.012, dish, hubRadius, [
                faceMaterial,
                sideMaterial,
            ]);
            break;
        }
        default: {
            // Pressed steel: a ring of vent holes and a raised centre.
            const count = style === 'atv' ? 6 : 8;
            const holes: Window[] = [];

            for (let i = 0; i < count; i++) {
                const a = ((i + 0.5) / count) * Math.PI * 2;
                const r = hubRadius + (Rr - hubRadius) * 0.5;
                holes.push(
                    circle(Math.min(0.022, (Rr - hubRadius) * 0.22), 20)
                        .map(
                            ([x, y]) =>
                                [
                                    x * 1.35 + Math.cos(a) * r,
                                    y + Math.sin(a) * r,
                                ] as Point,
                        )
                        .map(([x, y]) => {
                            // Stretch the hole round the rim into a slot.
                            const dx = x - Math.cos(a) * r;
                            const dy = y - Math.sin(a) * r;
                            const ca = Math.cos(a);
                            const sa = Math.sin(a);
                            const radial = dx * ca + dy * sa;
                            const tangential = -dx * sa + dy * ca;

                            return [
                                Math.cos(a) * r +
                                    ca * radial * 0.75 -
                                    sa * tangential * 1.6,
                                Math.sin(a) * r +
                                    sa * radial * 0.75 +
                                    ca * tangential * 1.6,
                            ] as Point;
                        }),
                );
            }

            face = wheelFace(lip - 0.002, holes, 0.008, dish, hubRadius, [
                faceMaterial,
                sideMaterial,
            ]);
            break;
        }
    }

    face.position.z = faceZ;
    group.add(face);

    // A motorcycle wheel is seen from both sides, so its face is doubled.
    if (style === 'moto') {
        const mirrored = face.clone();
        mirrored.scale.z = -1;
        mirrored.position.z = -faceZ;
        group.add(mirrored);
    }

    // Hub face, nuts, centre bore and cap.
    const hubZ = faceZ - dish + 0.015;

    const nut = boltGeometry(style === 'truck' ? 0.017 : 0.0105);
    const nuts: Transform[] = [];

    for (let i = 0; i < studs; i++) {
        const a = (i / studs) * Math.PI * 2 + Math.PI / 2;
        nuts.push({
            x: (Math.cos(a) * pcd) / 2,
            y: (Math.sin(a) * pcd) / 2,
            z: hubZ,
            rx: Math.PI / 2,
        });
    }

    if (style !== 'moto') {
        group.add(instanced(nut, alloy ? m.satin : m.zinc, nuts));
    }

    if (style === 'truck') {
        group.add(
            lathe(
                [
                    [0.095, 0.0],
                    [0.085, 0.035],
                    [0.05, 0.062],
                    [0, 0.07],
                ],
                m.steel,
                'z',
                0,
                0,
                hubZ,
                32,
            ),
        );
    } else if (alloy && style !== 'moto') {
        group.add(puck(0.032, 0.012, m.alloyPaint, 'z', 0, 0, hubZ + 0.004));
        group.add(
            torus(0.024, 0.0025, m.satin, 'z', 0, 0, hubZ + 0.011, {
                radial: 8,
                tubular: 32,
            }),
        );
    } else if (style !== 'moto') {
        group.add(puck(0.036, 0.03, m.steel, 'z', 0, 0, hubZ + 0.006));
    }

    // Valve stem through the barrel near the lip.
    const valve = cyl(
        0.0035,
        0.03,
        m.rubber,
        'z',
        0,
        -(Rr - 0.018),
        Wr / 2 - 0.02,
    );
    valve.rotation.x = Math.PI / 2 - 0.5;
    group.add(valve);
    group.add(
        cyl(0.0028, 0.008, m.chrome, 'z', 0, -(Rr - 0.012), Wr / 2 - 0.004),
    );

    return group;
}

/**
 * Brakes behind the wheel: a ventilated disc and a caliper at the back of
 * it, or a finned drum.
 */
export function buildBrake(m: Materials, spec: WheelSpec): THREE.Group {
    const group = new THREE.Group();
    const Rr = rimRadius(spec.tyre);

    if (spec.brake === 'none') {
        return group;
    }

    if (spec.brake === 'drum') {
        const r = Rr * 0.78;
        const ribs: Point[] = [[0.03, -0.09]];

        for (let i = 0; i <= 8; i++) {
            ribs.push([r - (i % 2 === 0 ? 0 : 0.008), -0.08 + i * 0.012]);
        }

        ribs.push([r * 0.5, 0.02], [0.03, 0.03]);
        group.add(lathe(ribs, m.castIron, 'z', 0, 0, -0.02, 48));

        return group;
    }

    const discRadius = Math.min(Rr - 0.035, Rr * 0.78);
    const discZ = -0.012;
    const faceThickness = 0.009;
    const gap = 0.011;

    for (const offset of [
        gap / 2 + faceThickness / 2,
        -(gap / 2 + faceThickness / 2),
    ]) {
        group.add(
            lathe(
                [
                    [discRadius * 0.52, -faceThickness / 2],
                    [discRadius - 0.001, -faceThickness / 2],
                    [discRadius, 0],
                    [discRadius - 0.001, faceThickness / 2],
                    [discRadius * 0.52, faceThickness / 2],
                ],
                m.disc,
                'z',
                0,
                0,
                discZ + offset,
                64,
            ),
        );
    }

    // Cooling vanes between the two faces.
    const vanes: Transform[] = [];
    const vaneCount = 36;

    for (let i = 0; i < vaneCount; i++) {
        const a = (i / vaneCount) * Math.PI * 2;
        const r = discRadius * 0.76;
        vanes.push({
            x: Math.cos(a) * r,
            y: Math.sin(a) * r,
            z: discZ,
            rz: a + 0.3,
        });
    }

    group.add(
        instanced(
            new THREE.BoxGeometry(discRadius * 0.46, 0.005, gap),
            m.castIron,
            vanes,
        ),
    );

    // The hat that bolts to the hub.
    group.add(
        lathe(
            [
                [discRadius * 0.52, discZ - gap / 2 - faceThickness],
                [discRadius * 0.5, discZ + 0.01],
                [discRadius * 0.48, discZ + 0.032],
                [0.03, discZ + 0.034],
            ],
            m.castIron,
            'z',
            0,
            0,
            0,
            48,
        ),
    );

    // Caliper straddling the disc behind the axle: a cast body with two
    // bolts, over the top edge of the disc.
    const caliper = new THREE.Group();
    const bodyMaterial = spec.caliper ?? m.caliper;
    const span = discRadius * 0.62;
    caliper.add(
        box(
            0.052,
            span,
            0.03,
            bodyMaterial,
            0,
            0,
            gap / 2 + faceThickness + 0.017,
            0.012,
        ),
    );
    caliper.add(
        box(
            0.05,
            span * 0.92,
            0.028,
            bodyMaterial,
            0,
            0,
            -(gap / 2 + faceThickness + 0.016),
            0.012,
        ),
    );
    caliper.add(
        box(
            0.036,
            span * 0.9,
            gap + faceThickness * 2 + 0.06,
            bodyMaterial,
            0.028,
            0,
            0,
            0.012,
        ),
    );
    caliper.add(
        cyl(
            0.0065,
            0.012,
            m.zinc,
            'z',
            -0.012,
            span * 0.3,
            gap / 2 + faceThickness + 0.037,
            { segments: 6 },
        ),
    );
    caliper.add(
        cyl(
            0.0065,
            0.012,
            m.zinc,
            'z',
            -0.012,
            -span * 0.3,
            gap / 2 + faceThickness + 0.037,
            { segments: 6 },
        ),
    );
    const angle = Math.PI * 0.86;
    caliper.position.set(
        Math.cos(angle) * (discRadius - 0.03),
        Math.sin(angle) * (discRadius - 0.03),
        discZ,
    );
    caliper.rotation.z = angle;
    group.add(caliper);

    // Dust shield behind everything.
    group.add(
        lathe(
            [
                [discRadius + 0.01, -0.03],
                [discRadius + 0.006, -0.042],
                [0.05, -0.05],
            ],
            m.steel,
            'z',
            0,
            0,
            0,
            48,
        ),
    );

    return group;
}

/**
 * A complete wheel on its hub, centred on the axle. `side` is +1 when the
 * outer face should look along +Z (the right-hand side of a vehicle).
 */
const templates = new WeakMap<Materials, Map<string, THREE.Group>>();

function wheelKey(spec: WheelSpec): string {
    return JSON.stringify([
        spec.tyre,
        spec.rim,
        spec.studs ?? null,
        spec.brake ?? 'disc',
        spec.caliper?.uuid ?? null,
        spec.dual ?? false,
        spec.rimMaterial?.uuid ?? null,
    ]);
}

export function buildWheel(
    m: Materials,
    spec: WheelSpec,
    side: 1 | -1,
): THREE.Group {
    // Every wheel on an axle set is the same, so it is built once and the
    // rest share its geometry.
    let cache = templates.get(m);

    if (!cache) {
        cache = new Map();
        templates.set(m, cache);
    }

    const key = wheelKey(spec);
    let template = cache.get(key);

    if (!template) {
        template = new THREE.Group();
        const wheel = new THREE.Group();
        wheel.name = 'wheel';
        wheel.add(buildTyre(m, spec.tyre), buildRim(m, spec));

        if (spec.dual) {
            const inner = new THREE.Group();
            inner.add(buildTyre(m, spec.tyre));
            const innerRim = buildRim(m, spec);
            innerRim.rotation.y = Math.PI;
            inner.add(innerRim);
            inner.position.z = -spec.tyre.width - 0.03;
            wheel.add(inner);
        }

        template.add(wheel);

        if (spec.brake !== 'none') {
            const brake = buildBrake(m, spec);
            brake.name = 'brake';
            template.add(brake);
        } else if (spec.rim !== 'moto') {
            // The hub flange and axle end fill the view through the rim.
            template.add(
                puck(
                    rimRadius(spec.tyre) - 0.025,
                    0.03,
                    m.castIron,
                    'z',
                    0,
                    0,
                    -0.03,
                ),
            );
        }

        template.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });

        cache.set(key, template);
    }

    const group = template.clone();

    // The tyre and rim turn round to face out on the left, as the same
    // wheel does on a real car; the brake hardware is mirrored instead, so
    // the calipers sit behind the axle on both sides.
    if (side === -1) {
        group.getObjectByName('wheel')!.rotation.y = Math.PI;
        const brake = group.getObjectByName('brake');

        if (brake) {
            brake.scale.z = -1;
        }
    }

    return group;
}

/**
 * Tyre sizes for each kind of vehicle.
 */
export const TYRES = {
    sedan: { width: 0.235, aspect: 0.45, rim: 18, tread: 'road' },
    hatch: { width: 0.215, aspect: 0.5, rim: 17, tread: 'road' },
    suv: {
        width: 0.255,
        aspect: 0.55,
        rim: 19,
        tread: 'highway',
        label: 'M+S',
    },
    ute: {
        width: 0.265,
        aspect: 0.65,
        rim: 17,
        tread: 'allTerrain',
        label: 'LT  M+S',
    },
    van: {
        width: 0.235,
        aspect: 0.65,
        rim: 16,
        tread: 'highway',
        label: 'C  M+S',
    },
    truck: {
        width: 0.295,
        aspect: 0.8,
        rim: 22.5,
        tread: 'truck',
        label: 'TUBELESS',
    },
    trailer: {
        width: 0.185,
        aspect: 0.8,
        rim: 14,
        tread: 'trailer',
        label: 'C',
    },
} satisfies Record<string, TyreSpec>;
