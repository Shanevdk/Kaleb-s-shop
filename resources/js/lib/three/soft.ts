import * as THREE from 'three';
import { place } from '@/lib/three/shapes';
import {
    edgeKey,
    emptyCage,
    subdivideQuads,
    type Cage,
} from '@/lib/three/subdivide';
import { surfaceFromQuads, surfaceGeometries } from '@/lib/three/surface';

export type SoftOptions = {
    /** Cage divisions along x, y and z. */
    divisions?: [number, number, number];
    /** Crease sharpness on the twelve box edges: 0 is pillow-soft. */
    crease?: number;
    levels?: number;
    /** Reshape the cage before it is smoothed: taper, bend, bulge. */
    shape?: (point: THREE.Vector3) => void;
    /** Leave these faces open: '+x', '-y' and so on. */
    open?: string[];
};

/**
 * A box cage with its faces divided into a grid, ready to be bent into
 * shape and subdivided.
 */
export function boxCage(
    w: number,
    h: number,
    d: number,
    options: SoftOptions = {},
): Cage {
    const [nx, ny, nz] = options.divisions ?? [2, 2, 2];
    const cage = emptyCage(0);
    const keys = new Map<string, number>();
    const vertex = (x: number, y: number, z: number): number => {
        const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
        const existing = keys.get(key);

        if (existing !== undefined) {
            return existing;
        }

        const index = cage.positions.length / 3;
        cage.positions.push(x, y, z);
        keys.set(key, index);

        return index;
    };

    // Each face: an origin corner and two axes spanning it, chosen so the
    // cross product points out of the box.
    const faces: {
        name: string;
        origin: [number, number, number];
        u: [number, number, number];
        v: [number, number, number];
        nu: number;
        nv: number;
    }[] = [
        {
            name: '+x',
            origin: [w / 2, -h / 2, d / 2],
            u: [0, 0, -d],
            v: [0, h, 0],
            nu: nz,
            nv: ny,
        },
        {
            name: '-x',
            origin: [-w / 2, -h / 2, -d / 2],
            u: [0, 0, d],
            v: [0, h, 0],
            nu: nz,
            nv: ny,
        },
        {
            name: '+y',
            origin: [-w / 2, h / 2, d / 2],
            u: [w, 0, 0],
            v: [0, 0, -d],
            nu: nx,
            nv: nz,
        },
        {
            name: '-y',
            origin: [-w / 2, -h / 2, -d / 2],
            u: [w, 0, 0],
            v: [0, 0, d],
            nu: nx,
            nv: nz,
        },
        {
            name: '+z',
            origin: [-w / 2, -h / 2, d / 2],
            u: [w, 0, 0],
            v: [0, h, 0],
            nu: nx,
            nv: ny,
        },
        {
            name: '-z',
            origin: [w / 2, -h / 2, -d / 2],
            u: [-w, 0, 0],
            v: [0, h, 0],
            nu: nx,
            nv: ny,
        },
    ];

    for (const face of faces) {
        if (options.open?.includes(face.name)) {
            continue;
        }

        const grid: number[][] = [];

        for (let i = 0; i <= face.nu; i++) {
            const row: number[] = [];

            for (let j = 0; j <= face.nv; j++) {
                const s = i / face.nu;
                const t = j / face.nv;
                row.push(
                    vertex(
                        face.origin[0] + face.u[0] * s + face.v[0] * t,
                        face.origin[1] + face.u[1] * s + face.v[1] * t,
                        face.origin[2] + face.u[2] * s + face.v[2] * t,
                    ),
                );
            }

            grid.push(row);
        }

        for (let i = 0; i < face.nu; i++) {
            for (let j = 0; j < face.nv; j++) {
                cage.faces.push([
                    grid[i][j],
                    grid[i + 1][j],
                    grid[i + 1][j + 1],
                    grid[i][j + 1],
                ]);
                cage.materials.push(0);
            }
        }
    }

    const crease = options.crease ?? 0;

    if (crease > 0) {
        // An edge is a box edge when both its ends sit on two box faces.
        const onEdge = (i: number) => {
            const x = cage.positions[i * 3];
            const y = cage.positions[i * 3 + 1];
            const z = cage.positions[i * 3 + 2];
            let count = 0;

            if (Math.abs(Math.abs(x) - w / 2) < 1e-6) count++;
            if (Math.abs(Math.abs(y) - h / 2) < 1e-6) count++;
            if (Math.abs(Math.abs(z) - d / 2) < 1e-6) count++;

            return count;
        };

        for (const face of cage.faces) {
            for (let i = 0; i < face.length; i++) {
                const a = face[i];
                const b = face[(i + 1) % face.length];

                if (onEdge(a) >= 2 && onEdge(b) >= 2) {
                    // Both on box edges, and on the same one.
                    const shared = [0, 1, 2].filter((axis) => {
                        const half = [w / 2, h / 2, d / 2][axis];

                        return (
                            Math.abs(
                                Math.abs(cage.positions[a * 3 + axis]) - half,
                            ) < 1e-6 &&
                            Math.abs(
                                Math.abs(cage.positions[b * 3 + axis]) - half,
                            ) < 1e-6 &&
                            Math.sign(cage.positions[a * 3 + axis]) ===
                                Math.sign(cage.positions[b * 3 + axis])
                        );
                    });

                    if (shared.length >= 2) {
                        cage.creases.set(edgeKey(a, b), crease);
                    }
                }
            }
        }
    }

    if (options.shape) {
        const point = new THREE.Vector3();

        for (let i = 0; i < cage.positions.length; i += 3) {
            point.set(
                cage.positions[i],
                cage.positions[i + 1],
                cage.positions[i + 2],
            );
            options.shape(point);
            cage.positions[i] = point.x;
            cage.positions[i + 1] = point.y;
            cage.positions[i + 2] = point.z;
        }
    }

    return cage;
}

export function softGeometry(
    w: number,
    h: number,
    d: number,
    options: SoftOptions = {},
): THREE.BufferGeometry {
    const cage = boxCage(w, h, d, options);
    const refined = subdivideQuads(cage, options.levels ?? 2);

    return surfaceGeometries(surfaceFromQuads(refined)).get(0)!;
}

/**
 * A soft-edged box: a seat cushion, a mirror housing, a dashboard, a fuel
 * tank. It keeps its footprint but rounds off like moulded or upholstered
 * things do.
 */
export function softBox(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    options: SoftOptions = {},
): THREE.Mesh {
    return place(
        new THREE.Mesh(softGeometry(w, h, d, options), material),
        x,
        y,
        z,
    );
}
