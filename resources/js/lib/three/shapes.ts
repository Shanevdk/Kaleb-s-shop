import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Axis = 'x' | 'y' | 'z';
export type Point = [number, number];
export type Point3 = [number, number, number];

/**
 * Every mesh casts and receives shadows; this is the one place that is
 * decided.
 */
export function place<T extends THREE.Object3D>(
    object: T,
    x = 0,
    y = 0,
    z = 0,
): T {
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;

    return object;
}

/**
 * Turn a geometry built along +Y so it runs along the given axis.
 */
export function orient(object: THREE.Object3D, axis: Axis): void {
    if (axis === 'x') {
        object.rotation.z = -Math.PI / 2;
    } else if (axis === 'z') {
        object.rotation.x = Math.PI / 2;
    }
}

/**
 * A box with softened edges. Nothing real has a knife edge, and the
 * rounding is what catches the light along every corner. Pass a radius of
 * zero for a hard box.
 */
export function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    radius?: number,
): THREE.Mesh {
    const r = Math.min(
        radius ?? Math.min(w, h, d) * 0.12,
        Math.min(w, h, d) / 2 - 0.0005,
    );
    const geometry =
        r > 0.0004
            ? new RoundedBoxGeometry(w, h, d, 2, r)
            : new THREE.BoxGeometry(w, h, d);

    return place(new THREE.Mesh(geometry, material), x, y, z);
}

export function cyl(
    radius: number,
    length: number,
    material: THREE.Material,
    axis: Axis,
    x = 0,
    y = 0,
    z = 0,
    options: { top?: number; segments?: number; open?: boolean } = {},
): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
        options.top ?? radius,
        radius,
        length,
        options.segments ?? 32,
        1,
        options.open ?? false,
    );
    const mesh = new THREE.Mesh(geometry, material);
    orient(mesh, axis);

    return place(mesh, x, y, z);
}

/**
 * A cylinder with rounded ends, turned from a profile: bosses, pulleys,
 * caps, canisters.
 */
export function puck(
    radius: number,
    length: number,
    material: THREE.Material,
    axis: Axis,
    x = 0,
    y = 0,
    z = 0,
    options: { fillet?: number; segments?: number } = {},
): THREE.Mesh {
    const f = Math.min(
        options.fillet ?? Math.min(radius, length) * 0.2,
        radius * 0.5,
        length / 2,
    );
    const h = length / 2;
    const profile: Point[] = [[0, -h]];

    for (let i = 0; i <= 4; i++) {
        const a = (Math.PI / 2) * (i / 4);
        profile.push([radius - f + Math.sin(a) * f, -h + f - Math.cos(a) * f]);
    }

    for (let i = 0; i <= 4; i++) {
        const a = (Math.PI / 2) * (i / 4);
        profile.push([radius - f + Math.cos(a) * f, h - f + Math.sin(a) * f]);
    }

    profile.push([0, h]);

    return lathe(profile, material, axis, x, y, z, options.segments ?? 32);
}

export function sphere(
    radius: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    scale: Point3 = [1, 1, 1],
): THREE.Mesh {
    const mesh = place(
        new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material),
        x,
        y,
        z,
    );
    mesh.scale.set(...scale);

    return mesh;
}

export function torus(
    radius: number,
    tube: number,
    material: THREE.Material,
    axis: Axis,
    x = 0,
    y = 0,
    z = 0,
    options: {
        arc?: number;
        start?: number;
        radial?: number;
        tubular?: number;
    } = {},
): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(
        radius,
        tube,
        options.radial ?? 12,
        options.tubular ?? 48,
        options.arc ?? Math.PI * 2,
    );

    if (options.start) {
        geometry.rotateZ(options.start);
    }

    const mesh = new THREE.Mesh(geometry, material);

    // A torus is born in the XY plane, which is the "z" axis.
    if (axis === 'y') {
        mesh.rotation.x = Math.PI / 2;
    } else if (axis === 'x') {
        mesh.rotation.y = Math.PI / 2;
    }

    return place(mesh, x, y, z);
}

/**
 * A smooth pipe through the given points: hoses, frames, exhausts, wires.
 */
export function tube(
    points: Point3[],
    radius: number,
    material: THREE.Material,
    options: {
        closed?: boolean;
        segments?: number;
        radial?: number;
        tension?: number;
    } = {},
): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(
        points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        options.closed ?? false,
        'catmullrom',
        options.tension ?? 0.5,
    );
    const geometry = new THREE.TubeGeometry(
        curve,
        options.segments ?? Math.max(16, points.length * 10),
        radius,
        options.radial ?? 12,
        options.closed ?? false,
    );

    return place(new THREE.Mesh(geometry, material));
}

/**
 * A bent pipe with square corners rounded to the given radius, the way a
 * tube bender makes it: frames, roll cages, handles, brake lines.
 */
export function bentTube(
    points: Point3[],
    radius: number,
    material: THREE.Material,
    bend = radius * 3,
    options: { radial?: number; closed?: boolean } = {},
): THREE.Mesh {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const v = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const closed = options.closed ?? false;
    const count = v.length;
    const corners: {
        before: THREE.Vector3;
        corner: THREE.Vector3;
        after: THREE.Vector3;
    }[] = [];

    for (let i = 0; i < count; i++) {
        if (!closed && (i === 0 || i === count - 1)) {
            corners.push({ before: v[i], corner: v[i], after: v[i] });
            continue;
        }

        const previous = v[(i - 1 + count) % count];
        const next = v[(i + 1) % count];
        const toPrevious = previous.clone().sub(v[i]);
        const toNext = next.clone().sub(v[i]);
        const r = Math.min(bend, toPrevious.length() / 2, toNext.length() / 2);
        corners.push({
            before: v[i].clone().addScaledVector(toPrevious.normalize(), r),
            corner: v[i],
            after: v[i].clone().addScaledVector(toNext.normalize(), r),
        });
    }

    const last = closed ? count : count - 1;

    for (let i = 0; i < last; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % count];

        if (a.after.distanceTo(b.before) > 1e-5) {
            path.add(new THREE.LineCurve3(a.after, b.before));
        }

        if (
            (closed || i + 1 < count - 1) &&
            b.before.distanceTo(b.after) > 1e-5
        ) {
            path.add(
                new THREE.QuadraticBezierCurve3(b.before, b.corner, b.after),
            );
        }
    }

    const geometry = new THREE.TubeGeometry(
        path,
        Math.max(24, Math.round(path.getLength() / 0.01)),
        radius,
        options.radial ?? 12,
        closed,
    );

    return place(new THREE.Mesh(geometry, material));
}

/**
 * Revolve a (radius, height) profile around an axis.
 */
export function lathe(
    profile: Point[],
    material: THREE.Material,
    axis: Axis,
    x = 0,
    y = 0,
    z = 0,
    segments = 48,
): THREE.Mesh {
    const geometry = new THREE.LatheGeometry(
        profile.map(([r, h]) => new THREE.Vector2(Math.max(0, r), h)),
        segments,
    );
    const mesh = new THREE.Mesh(geometry, material);
    orient(mesh, axis);

    return place(mesh, x, y, z);
}

/**
 * A closed polygon.
 */
export function polygon(points: Point[]): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);

    for (const [x, y] of points.slice(1)) {
        shape.lineTo(x, y);
    }

    shape.closePath();

    return shape;
}

/**
 * A closed path for a hole in a shape.
 */
export function hole(points: Point[]): THREE.Path {
    const path = new THREE.Path();
    path.moveTo(points[0][0], points[0][1]);

    for (const [x, y] of points.slice(1)) {
        path.lineTo(x, y);
    }

    path.closePath();

    return path;
}

/**
 * Extrude a shape symmetrically about the axis it is thick along, with
 * rounded edges.
 */
export function extrude(
    shape: THREE.Shape,
    depth: number,
    material: THREE.Material | THREE.Material[],
    options: {
        bevel?: number;
        axis?: Axis;
        x?: number;
        y?: number;
        z?: number;
        curveSegments?: number;
    } = {},
): THREE.Mesh {
    const bevel = Math.min(options.bevel ?? 0.01, depth / 2 - 0.0005);
    const core = Math.max(0.0005, depth - bevel * 2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: core,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        steps: 1,
        curveSegments: options.curveSegments ?? 24,
    });
    geometry.translate(0, 0, -core / 2);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);

    // Extrusions are born thick along Z; "y" lays the shape flat on the
    // ground, "x" stands it across the vehicle.
    if (options.axis === 'y') {
        mesh.rotation.x = -Math.PI / 2;
    } else if (options.axis === 'x') {
        mesh.rotation.y = Math.PI / 2;
    }

    return place(mesh, options.x ?? 0, options.y ?? 0, options.z ?? 0);
}

/**
 * A slab between two points in the side view: pillars, struts, arms.
 */
export function strut(
    from: Point,
    to: Point,
    thickness: number,
    depth: number,
    material: THREE.Material,
    z = 0,
    radius?: number,
): THREE.Mesh {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const mesh = box(
        length,
        thickness,
        depth,
        material,
        (from[0] + to[0]) / 2,
        (from[1] + to[1]) / 2,
        z,
        radius,
    );
    mesh.rotation.z = Math.atan2(to[1] - from[1], to[0] - from[0]);

    return mesh;
}

/**
 * A round bar between two points anywhere in space.
 */
export function rod(
    from: Point3,
    to: Point3,
    radius: number,
    material: THREE.Material,
    segments = 12,
): THREE.Mesh {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const length = a.distanceTo(b);
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, segments),
        material,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

export type Transform = {
    x: number;
    y: number;
    z: number;
    rx?: number;
    ry?: number;
    rz?: number;
    s?: number;
    sx?: number;
    sy?: number;
    sz?: number;
};

/**
 * Lots of the same small thing: fins, bolts, tread blocks, grille slats.
 */
export function instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    transforms: Transform[],
): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    transforms.forEach((t, index) => {
        position.set(t.x, t.y, t.z);
        rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
        quaternion.setFromEuler(rotation);
        scale.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();

    return mesh;
}

/**
 * A hex bolt head with a washer face, standing up +Y.
 */
export function boltGeometry(size: number): THREE.BufferGeometry {
    const head = new THREE.CylinderGeometry(size, size, size * 0.65, 6);
    head.translate(0, size * 0.325 + size * 0.12, 0);
    const washer = new THREE.CylinderGeometry(
        size * 1.15,
        size * 1.2,
        size * 0.12,
        16,
    );
    washer.translate(0, size * 0.06, 0);
    const merged = mergeGeometries([washer, head]);
    head.dispose();
    washer.dispose();

    return merged;
}

/**
 * Bolt heads dotted around, for covers and flanges. They stand out along
 * the given axis (the direction the bolt points away from the surface).
 */
export function bolts(
    material: THREE.Material,
    size: number,
    positions: Point3[],
    axis: Axis | '-x' | '-y' | '-z' = 'y',
): THREE.InstancedMesh {
    const rotations: Record<string, [number, number, number]> = {
        y: [0, 0, 0],
        '-y': [Math.PI, 0, 0],
        x: [0, 0, -Math.PI / 2],
        '-x': [0, 0, Math.PI / 2],
        z: [Math.PI / 2, 0, 0],
        '-z': [-Math.PI / 2, 0, 0],
    };
    const [rx, ry, rz] = rotations[axis];

    return instanced(
        boltGeometry(size),
        material,
        positions.map(([x, y, z], i) => ({
            x,
            y,
            z,
            rx,
            ry,
            rz: rz + (axis === 'y' || axis === '-y' ? i * 0.7 : 0),
        })),
    );
}

/**
 * Merge simple indexed or non-indexed geometries with the same attributes.
 */
export function mergeGeometries(
    geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
    const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const names = Object.keys(parts[0].attributes).filter((name) =>
        parts.every((part) => part.attributes[name]),
    );
    const merged = new THREE.BufferGeometry();

    for (const name of names) {
        const itemSize = parts[0].attributes[name].itemSize;
        const total = parts.reduce(
            (sum, part) => sum + part.attributes[name].count,
            0,
        );
        const array = new Float32Array(total * itemSize);
        let offset = 0;

        for (const part of parts) {
            const attribute = part.attributes[name];

            for (let i = 0; i < attribute.count; i++) {
                for (let c = 0; c < itemSize; c++) {
                    array[offset++] = attribute.getComponent(i, c);
                }
            }
        }

        merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    }

    parts.forEach((part, i) => {
        if (part !== geometries[i]) {
            part.dispose();
        }
    });

    return merged;
}
