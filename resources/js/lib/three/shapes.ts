import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Materials } from '@/lib/three/materials';

export type Axis = 'x' | 'y' | 'z';
export type Point = [number, number];
export type Point3 = [number, number, number];

/**
 * Every mesh in the model casts and receives shadows; this is the one place
 * that is decided.
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

export function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    radius = 0,
): THREE.Mesh {
    const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
    const geometry =
        radius > 0
            ? new RoundedBoxGeometry(w, h, d, 3, r)
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

export function sphere(
    radius: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    scale: Point3 = [1, 1, 1],
): THREE.Mesh {
    const mesh = place(
        new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), material),
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
 * A smooth pipe through the given points. Hoses, frames, exhausts, belts.
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
        options.segments ?? 32,
        radius,
        options.radial ?? 10,
        options.closed ?? false,
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
        profile.map(([r, h]) => new THREE.Vector2(r, h)),
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
 * A vehicle's side silhouette. The points run from the front bumper's
 * bottom, up and over the roof line, to the rear bumper's bottom; the
 * underside is drawn back along the floor with the wheel arches cut out.
 */
export function silhouette(
    points: Point[],
    arches: { x: number; radius: number }[],
    floor: number,
): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);

    for (const [x, y] of points.slice(1)) {
        shape.lineTo(x, y);
    }

    const rear = points[points.length - 1][0];
    shape.lineTo(rear, floor);

    for (const arch of [...arches].sort((a, b) => a.x - b.x)) {
        shape.lineTo(arch.x - arch.radius, floor);
        shape.absarc(arch.x, floor, arch.radius, Math.PI, 0, true);
    }

    shape.lineTo(points[0][0], floor);
    shape.closePath();

    return shape;
}

/**
 * Extrude a shape symmetrically about the axis it is thick along.
 */
export function extrude(
    shape: THREE.Shape,
    depth: number,
    material: THREE.Material,
    options: {
        bevel?: number;
        axis?: Axis;
        x?: number;
        y?: number;
        z?: number;
    } = {},
): THREE.Mesh {
    const bevel = options.bevel ?? 0.04;
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.01, depth - bevel * 2),
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 4,
        steps: 1,
        curveSegments: 24,
    });
    geometry.translate(0, 0, -Math.max(0.01, depth - bevel * 2) / 2);
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
    radius = 0,
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

export type Transform = {
    x: number;
    y: number;
    z: number;
    rx?: number;
    ry?: number;
    rz?: number;
    s?: number;
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
        scale.setScalar(t.s ?? 1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

/**
 * Bolt heads dotted around, for covers and flanges.
 */
export function bolts(
    material: THREE.Material,
    radius: number,
    positions: Point3[],
    axis: Axis = 'y',
): THREE.InstancedMesh {
    const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        radius * 1.2,
        6,
    );

    return instanced(
        geometry,
        material,
        positions.map(([x, y, z]) => ({
            x,
            y,
            z,
            rz: axis === 'x' ? -Math.PI / 2 : 0,
            rx: axis === 'z' ? Math.PI / 2 : 0,
        })),
    );
}

/**
 * A complete wheel: a lathed tyre with shoulders and tread, an alloy or
 * steel rim with spokes, hub, nuts, and a brake disc and caliper behind.
 */
export function wheel(
    m: Materials,
    radius: number,
    width: number,
    x: number,
    z: number,
    options: {
        side?: 1 | -1;
        offroad?: boolean;
        spokes?: number;
        open?: boolean;
        dual?: boolean;
        steel?: boolean;
        brake?: boolean;
    } = {},
): THREE.Group {
    const side = options.side ?? (z >= 0 ? 1 : -1);
    const group = new THREE.Group();
    group.position.set(x, radius, z);
    group.rotation.y = side === -1 ? Math.PI : 0;

    const rimRadius = radius * (options.offroad ? 0.56 : 0.64);
    const shoulder = radius * 0.07;
    const half = width / 2;

    const tyre = lathe(
        [
            [rimRadius, -half + 0.01],
            [rimRadius + 0.02, -half],
            [radius - shoulder, -half + 0.004],
            [radius, -half + shoulder],
            [radius, half - shoulder],
            [radius - shoulder, half - 0.004],
            [rimRadius + 0.02, half],
            [rimRadius, half - 0.01],
        ],
        m.rubber,
        'z',
        0,
        0,
        0,
        64,
    );
    group.add(tyre);

    // Tread grooves and the raised sidewall band.
    for (const offset of [-width * 0.2, 0, width * 0.2]) {
        group.add(
            torus(radius + 0.002, 0.004, m.plastic, 'z', 0, 0, offset, {
                radial: 6,
                tubular: 64,
            }),
        );
    }
    group.add(
        torus(
            radius - shoulder * 1.6,
            0.006,
            m.plastic,
            'z',
            0,
            0,
            half - 0.002,
            { radial: 6, tubular: 64 },
        ),
    );

    if (options.offroad) {
        const lug = new THREE.BoxGeometry(radius * 0.22, 0.016, width * 0.44);
        const lugs: Transform[] = [];
        const count = 22;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            lugs.push({
                x: Math.cos(angle) * (radius + 0.006),
                y: Math.sin(angle) * (radius + 0.006),
                z: i % 2 === 0 ? width * 0.2 : -width * 0.2,
                rz: angle + Math.PI / 2,
            });
        }

        group.add(instanced(lug, m.rubber, lugs));
    }

    const rimMaterial = options.steel ? m.steel : m.alloy;
    const face = options.open ? 0 : width * 0.3;

    if (!options.open) {
        group.add(
            cyl(rimRadius - 0.005, width * 0.82, m.barrel, 'z', 0, 0, 0, {
                open: true,
                segments: 40,
            }),
        );
        group.add(
            cyl(rimRadius, 0.03, rimMaterial, 'z', 0, 0, face + 0.015, {
                top: rimRadius - 0.03,
                segments: 40,
                open: true,
            }),
        );
        group.add(
            cyl(rimRadius - 0.03, 0.02, m.barrel, 'z', 0, 0, face + 0.01, {
                segments: 40,
            }),
        );
    }

    const spokeCount = options.spokes ?? 5;
    const spokeLength = rimRadius * 0.86;
    const spokeGeometry = new THREE.BoxGeometry(
        spokeLength,
        options.open ? 0.012 : rimRadius * 0.16,
        options.open ? 0.012 : 0.05,
    );
    const spokes: Transform[] = [];

    for (let i = 0; i < spokeCount; i++) {
        const angle = (i / spokeCount) * Math.PI * 2;
        spokes.push({
            x: (Math.cos(angle) * spokeLength) / 2,
            y: (Math.sin(angle) * spokeLength) / 2,
            z: face + (options.open ? 0.02 : 0.02),
            rz: angle,
        });

        if (options.open) {
            spokes.push({
                x: (Math.cos(angle + Math.PI / spokeCount) * spokeLength) / 2,
                y: (Math.sin(angle + Math.PI / spokeCount) * spokeLength) / 2,
                z: -0.02,
                rz: angle + Math.PI / spokeCount,
            });
        }
    }

    group.add(instanced(spokeGeometry, rimMaterial, spokes));

    const hubRadius = rimRadius * (options.open ? 0.18 : 0.3);
    group.add(
        cyl(hubRadius, 0.06, rimMaterial, 'z', 0, 0, face + 0.02, {
            segments: 32,
        }),
    );
    group.add(
        cyl(hubRadius * 0.4, 0.02, m.chrome, 'z', 0, 0, face + 0.06, {
            segments: 24,
        }),
    );

    if (!options.open) {
        const nuts: Point3[] = [];

        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + 0.3;
            nuts.push([
                Math.cos(angle) * hubRadius * 0.62,
                Math.sin(angle) * hubRadius * 0.62,
                face + 0.055,
            ]);
        }

        group.add(bolts(m.chrome, 0.014, nuts, 'z'));
    }

    if (options.brake ?? true) {
        group.add(
            cyl(
                rimRadius * 0.8,
                0.024,
                m.disc,
                'z',
                0,
                0,
                options.open ? 0.05 : -0.02,
                { segments: 48 },
            ),
        );
        group.add(
            cyl(
                rimRadius * 0.28,
                0.06,
                m.iron,
                'z',
                0,
                0,
                options.open ? 0.05 : -0.02,
                { segments: 24 },
            ),
        );

        const caliper = box(
            rimRadius * 0.34,
            rimRadius * 0.6,
            0.075,
            m.iron,
            0,
            0,
            options.open ? 0.05 : -0.02,
            0.012,
        );
        const angle = Math.PI * 0.62;
        caliper.position.x = Math.cos(angle) * rimRadius * 0.62;
        caliper.position.y = Math.sin(angle) * rimRadius * 0.62;
        caliper.rotation.z = angle + Math.PI / 2;
        group.add(caliper);
    }

    if (options.dual) {
        const inner = tyre.clone();
        inner.position.z = -width - 0.02;
        group.add(inner);
        group.add(
            cyl(rimRadius, width * 0.8, m.barrel, 'z', 0, 0, -width - 0.02, {
                open: true,
                segments: 40,
            }),
        );
    }

    return group;
}

/**
 * A headlight: a dark housing, a bright reflector inside, a clear lens over
 * the front.
 */
export function headlight(
    m: Materials,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    facing: 1 | -1 = 1,
): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(box(0.08, h, w, m.plastic, -0.03 * facing, 0, 0, 0.01));
    group.add(
        cyl(h * 0.36, 0.03, m.chrome, 'x', 0.005 * facing, 0, w * 0.22, {
            segments: 24,
        }),
    );
    group.add(
        cyl(h * 0.36, 0.03, m.chrome, 'x', 0.005 * facing, 0, -w * 0.22, {
            segments: 24,
        }),
    );
    group.add(box(0.025, h, w, m.lens, 0.025 * facing, 0, 0, 0.01));

    return group;
}

export function taillight(
    m: Materials,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
): THREE.Mesh {
    return box(0.03, h, w, m.tailLens, x, y, z, 0.01);
}

/**
 * A door mirror on its stalk.
 */
export function mirror(
    m: Materials,
    x: number,
    y: number,
    z: number,
): THREE.Group {
    const side = z >= 0 ? 1 : -1;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(box(0.05, 0.035, 0.09, m.plastic, 0, -0.02, -0.05 * side));
    group.add(box(0.1, 0.12, 0.2, m.paint, 0, 0.02, 0.06 * side, 0.03));
    group.add(box(0.012, 0.1, 0.17, m.chrome, -0.05, 0.02, 0.06 * side));

    return group;
}

/**
 * A number plate with its frame.
 */
export function plate(
    m: Materials,
    x: number,
    y: number,
    facing: 1 | -1 = 1,
): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    group.add(box(0.015, 0.14, 0.4, m.plastic, 0, 0, 0));
    group.add(box(0.008, 0.12, 0.37, m.plate, 0.01 * facing, 0, 0));

    return group;
}

/**
 * A flat grille with horizontal slats.
 */
export function grille(
    m: Materials,
    w: number,
    h: number,
    x: number,
    y: number,
    z = 0,
    slats = 4,
    facing: 1 | -1 = 1,
): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(box(0.04, h, w, m.plastic, 0, 0, 0));

    const slat = new THREE.BoxGeometry(0.02, h / (slats * 2.2), w - 0.04);
    const transforms: Transform[] = [];

    for (let i = 0; i < slats; i++) {
        transforms.push({
            x: 0.02 * facing,
            y: -h / 2 + (h / (slats + 1)) * (i + 1),
            z: 0,
        });
    }

    group.add(instanced(slat, m.chrome, transforms));

    return group;
}

/**
 * A partial-ring wheel arch flare or mudguard.
 */
export function arch(
    m: Materials,
    radius: number,
    tubeRadius: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = m.plastic,
    arc = Math.PI,
): THREE.Mesh {
    return torus(radius, tubeRadius, material, 'z', x, y, z, {
        arc,
        start: 0,
        radial: 8,
        tubular: 36,
    });
}
