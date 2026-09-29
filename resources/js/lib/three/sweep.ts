import * as THREE from 'three';
import type { Polyline } from '@/lib/three/surface';

/**
 * Evenly respace a polyline and relax it a little, so a line traced across
 * triangle edges comes out as a smooth run of trim rather than a zigzag.
 */
export function smoothPolyline(
    line: Polyline,
    spacing: number,
    relax = 2,
): Polyline {
    const source = line.closed ? [...line.points, line.points[0]] : line.points;
    const sourceNormals = line.closed
        ? [...line.normals, line.normals[0]]
        : line.normals;
    const lengths = [0];

    for (let i = 1; i < source.length; i++) {
        lengths.push(lengths[i - 1] + source[i].distanceTo(source[i - 1]));
    }

    const total = lengths[lengths.length - 1];

    if (total < 1e-6) {
        return line;
    }

    const count = Math.max(line.closed ? 3 : 2, Math.round(total / spacing));
    const points: THREE.Vector3[] = [];
    const normals: THREE.Vector3[] = [];
    let segment = 1;
    const steps = line.closed ? count : count + 1;

    for (let i = 0; i < steps; i++) {
        const target = (total * i) / count;

        while (segment < lengths.length - 1 && lengths[segment] < target) {
            segment += 1;
        }

        const span = lengths[segment] - lengths[segment - 1] || 1;
        const t = Math.min(
            1,
            Math.max(0, (target - lengths[segment - 1]) / span),
        );
        points.push(source[segment - 1].clone().lerp(source[segment], t));
        normals.push(
            sourceNormals[segment - 1]
                .clone()
                .lerp(sourceNormals[segment], t)
                .normalize(),
        );
    }

    for (let pass = 0; pass < relax; pass++) {
        const copy = points.map((point) => point.clone());

        for (let i = 0; i < points.length; i++) {
            if (!line.closed && (i === 0 || i === points.length - 1)) {
                continue;
            }

            const before = copy[(i - 1 + copy.length) % copy.length];
            const after = copy[(i + 1) % copy.length];
            points[i]
                .copy(copy[i])
                .multiplyScalar(0.5)
                .addScaledVector(before, 0.25)
                .addScaledVector(after, 0.25);
        }
    }

    return { points, normals, closed: line.closed };
}

/**
 * Sweep a cross-section along a line that lies on a surface.
 *
 * The profile's x runs across the line within the surface and its y
 * stands out along the surface normal, so a seal, a chrome strip or a
 * shut line sits on the panel the way it would on the real thing.
 */
export function sweepAlong(
    line: Polyline,
    profile: THREE.Vector2[],
    options: { closedProfile?: boolean; lift?: number } = {},
): THREE.BufferGeometry {
    const { points, normals, closed } = line;
    const closedProfile = options.closedProfile ?? true;
    const lift = options.lift ?? 0;
    const count = points.length;
    const ring = profile.length;
    const positions: number[] = [];
    const vertexNormals: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];

    const tangent = new THREE.Vector3();
    const up = new THREE.Vector3();
    const side = new THREE.Vector3();
    const outward = new THREE.Vector3();
    let travelled = 0;

    // Profile normals in 2D, pointing out of the solid for a closed
    // profile and away from the surface for an open one.
    let area = 0;

    for (let i = 0; i < ring; i++) {
        const a = profile[i];
        const b = profile[(i + 1) % ring];
        area += a.x * b.y - b.x * a.y;
    }

    const profileNormals = profile.map((_, i) => {
        const before = profile[(i - 1 + ring) % ring];
        const after = profile[(i + 1) % ring];
        const edge =
            !closedProfile && i === 0
                ? profile[1].clone().sub(profile[0])
                : !closedProfile && i === ring - 1
                  ? profile[ring - 1].clone().sub(profile[ring - 2])
                  : after.clone().sub(before);

        return new THREE.Vector2(edge.y, -edge.x).normalize();
    });
    const upward = profileNormals.reduce((sum, n) => sum + n.y, 0);

    if ((closedProfile && area < 0) || (!closedProfile && upward < 0)) {
        profileNormals.forEach((n) => n.negate());
    }

    for (let i = 0; i < count; i++) {
        const before =
            points[closed ? (i - 1 + count) % count : Math.max(0, i - 1)];
        const after =
            points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)];
        tangent.subVectors(after, before).normalize();
        up.copy(normals[i])
            .addScaledVector(tangent, -normals[i].dot(tangent))
            .normalize();
        side.crossVectors(tangent, up).normalize();

        if (i > 0) {
            travelled += points[i].distanceTo(points[i - 1]);
        }

        profile.forEach((p, j) => {
            positions.push(
                points[i].x + side.x * p.x + up.x * (p.y + lift),
                points[i].y + side.y * p.x + up.y * (p.y + lift),
                points[i].z + side.z * p.x + up.z * (p.y + lift),
            );
            const n = profileNormals[j];
            outward
                .copy(side)
                .multiplyScalar(n.x)
                .addScaledVector(up, n.y)
                .normalize();
            vertexNormals.push(outward.x, outward.y, outward.z);
            uvs.push(travelled, j / Math.max(1, ring - 1));
        });
    }

    const segments = closed ? count : count - 1;
    const sides = closedProfile ? ring : ring - 1;

    for (let i = 0; i < segments; i++) {
        const a = i * ring;
        const b = ((i + 1) % count) * ring;

        for (let j = 0; j < sides; j++) {
            const j2 = (j + 1) % ring;
            index.push(a + j, b + j, b + j2, a + j, b + j2, a + j2);
        }
    }

    // Which way round the triangles wind depends on which way the line
    // runs; make them face the same way as the normals.
    let agreement = 0;

    for (let t = 0; t < Math.min(index.length, 600); t += 3) {
        const [i0, i1, i2] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
        const ux = positions[i1] - positions[i0];
        const uy = positions[i1 + 1] - positions[i0 + 1];
        const uz = positions[i1 + 2] - positions[i0 + 2];
        const wx = positions[i2] - positions[i0];
        const wy = positions[i2 + 1] - positions[i0 + 1];
        const wz = positions[i2 + 2] - positions[i0 + 2];
        const nx = uy * wz - uz * wy;
        const ny = uz * wx - ux * wz;
        const nz = ux * wy - uy * wx;
        agreement +=
            nx * (vertexNormals[i0] + vertexNormals[i1] + vertexNormals[i2]) +
            ny *
                (vertexNormals[i0 + 1] +
                    vertexNormals[i1 + 1] +
                    vertexNormals[i2 + 1]) +
            nz *
                (vertexNormals[i0 + 2] +
                    vertexNormals[i1 + 2] +
                    vertexNormals[i2 + 2]);
    }

    if (agreement < 0) {
        for (let t = 0; t < index.length; t += 3) {
            const swap = index[t + 1];
            index[t + 1] = index[t + 2];
            index[t + 2] = swap;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(vertexNormals, 3),
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);

    return geometry;
}

/**
 * Common trim cross-sections, in metres.
 */
export const PROFILES = {
    /** A dark groove drawn onto a panel: a shut line. */
    seam(width = 0.0045): THREE.Vector2[] {
        return [
            new THREE.Vector2(-width / 2, 0),
            new THREE.Vector2(-width * 0.3, 0.0004),
            new THREE.Vector2(width * 0.3, 0.0004),
            new THREE.Vector2(width / 2, 0),
        ];
    },

    /** A rounded rubber seal or trim strip. */
    rounded(width: number, height: number, segments = 8): THREE.Vector2[] {
        const points: THREE.Vector2[] = [];

        for (let i = 0; i <= segments; i++) {
            const angle = Math.PI - (Math.PI * i) / segments;
            points.push(
                new THREE.Vector2(
                    (Math.cos(angle) * width) / 2,
                    Math.sin(angle) * height,
                ),
            );
        }

        points.push(new THREE.Vector2(width / 2, -height * 0.4));
        points.push(new THREE.Vector2(-width / 2, -height * 0.4));

        return points;
    },

    /** A lip that rolls back under itself, for wheel arches. */
    lip(depth: number, thickness: number): THREE.Vector2[] {
        const points: THREE.Vector2[] = [];
        const segments = 10;

        for (let i = 0; i <= segments; i++) {
            const angle = -Math.PI / 2 + (Math.PI * i) / segments;
            points.push(
                new THREE.Vector2(
                    Math.cos(angle) * thickness,
                    Math.sin(angle) * thickness - thickness,
                ),
            );
        }

        points.push(new THREE.Vector2(-depth, -thickness * 0.2));
        points.push(new THREE.Vector2(-depth, -thickness * 1.8));

        return points;
    },
};
