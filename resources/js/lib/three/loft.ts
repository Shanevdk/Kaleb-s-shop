import * as THREE from 'three';
import { place } from '@/lib/three/shapes';

/**
 * One cross-section of a lofted body, cut across the machine at station x.
 *
 * The outline is a superellipse stretched to the given top, bottom and
 * width: `squareness` of 2 is an ellipse, 6 is nearly a box. `tuck` pulls
 * the bottom in (sills under a car), `taper` pulls the top in (the
 * tumblehome of a glasshouse). The widest point sits at `waist`, a 0..1
 * fraction of the way from bottom to top.
 */
export type Section = {
    x: number;
    bottom: number;
    top: number;
    halfWidth: number;
    squareness?: number;
    tuck?: number;
    taper?: number;
    waist?: number;
};

export type LoftOptions = {
    /** Points around each section. */
    segments?: number;
    /** Angular range in radians for an open strip instead of a closed ring. */
    arc?: [number, number];
    /** Flat cap over the first section. */
    capStart?: boolean;
    /** Flat cap over the last section. */
    capEnd?: boolean;
    /** Wind the faces the other way, for the underside of an open strip. */
    flip?: boolean;
};

function signedPow(value: number, exponent: number): number {
    return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

/**
 * The (y, z) points around one section.
 */
export function sectionPoints(
    section: Section,
    segments: number,
    arc?: [number, number],
): THREE.Vector2[] {
    const n = section.squareness ?? 4.5;
    const tuck = section.tuck ?? 0;
    const taper = section.taper ?? 0;
    const waist =
        section.bottom +
        (section.top - section.bottom) * (section.waist ?? 0.6);
    const closed = arc === undefined;
    const start = arc?.[0] ?? 0;
    const end = arc?.[1] ?? Math.PI * 2;
    const count = closed ? segments : segments + 1;
    const points: THREE.Vector2[] = [];

    for (let i = 0; i < count; i++) {
        const theta = start + ((end - start) * i) / segments;
        const zz = signedPow(Math.cos(theta), 2 / n);
        const yy = signedPow(Math.sin(theta), 2 / n);
        const y =
            yy >= 0
                ? waist + yy * (section.top - waist)
                : waist + yy * (waist - section.bottom);
        const width = 1 - (yy >= 0 ? taper * yy : tuck * -yy);

        points.push(new THREE.Vector2(y, zz * section.halfWidth * width));
    }

    return points;
}

/**
 * Skin a run of sections into one smooth surface.
 */
export function loft(
    sections: Section[],
    options: LoftOptions = {},
): THREE.BufferGeometry {
    const segments = options.segments ?? 48;
    const closed = options.arc === undefined;
    const ringSize = closed ? segments : segments + 1;
    const positions: number[] = [];
    const indices: number[] = [];

    for (const section of sections) {
        for (const point of sectionPoints(section, segments, options.arc)) {
            positions.push(section.x, point.x, point.y);
        }
    }

    for (let s = 0; s < sections.length - 1; s++) {
        const a = s * ringSize;
        const b = (s + 1) * ringSize;
        const quads = closed ? segments : segments;

        for (let i = 0; i < quads; i++) {
            const j = closed ? (i + 1) % ringSize : i + 1;
            indices.push(a + i, b + j, b + i);
            indices.push(a + i, a + j, b + j);
        }
    }

    const cap = (ring: number, flip: boolean) => {
        const section = sections[ring];
        const centreIndex = positions.length / 3;
        positions.push(section.x, (section.top + section.bottom) / 2, 0);
        const base = ring * ringSize;

        for (let i = 0; i < (closed ? segments : segments); i++) {
            const j = closed ? (i + 1) % ringSize : i + 1;

            if (flip) {
                indices.push(centreIndex, base + i, base + j);
            } else {
                indices.push(centreIndex, base + j, base + i);
            }
        }
    };

    if (options.capStart) {
        cap(0, false);
    }

    if (options.capEnd) {
        cap(sections.length - 1, true);
    }

    if (options.flip) {
        for (let i = 0; i < indices.length; i += 3) {
            const swap = indices[i + 1];
            indices[i + 1] = indices[i + 2];
            indices[i + 2] = swap;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

export function loftMesh(
    sections: Section[],
    material: THREE.Material,
    options: LoftOptions = {},
): THREE.Mesh {
    const mesh = new THREE.Mesh(loft(sections, options), material);

    return place(mesh);
}

/**
 * Stations that trace a wheel arch: the section bottoms follow the arc so
 * the opening comes out round.
 */
export function archStations(
    x: number,
    radius: number,
    axleHeight: number,
    build: (station: number, bottom: number) => Section,
): Section[] {
    const offsets = [
        -1, -0.92, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 0.92, 1,
    ];

    return offsets.map((offset) => {
        const dx = offset * radius;
        const bottom =
            axleHeight + Math.sqrt(Math.max(0, radius * radius - dx * dx));

        return build(x + dx, bottom);
    });
}
