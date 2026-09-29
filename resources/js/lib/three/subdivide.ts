/**
 * Catmull-Clark subdivision with creases.
 *
 * Real bodywork is modelled this way: a coarse cage of quads is refined
 * again and again until it becomes a smooth surface with the same flow as
 * the cage. Creases keep a character line, a panel edge or a window frame
 * crisp for a few levels before it softens, and open edges stay where they
 * are drawn. Every point can carry extra values (the design coordinates a
 * feature is placed by), refined exactly like the positions so they stay
 * glued to the surface.
 */
export type Cage = {
    /** x, y, z per point. */
    positions: number[];
    /** Extra values per point, refined with the same weights as positions. */
    attributes: number[];
    attributeSize: number;
    /** Point indices of each face, counter-clockwise from outside. */
    faces: number[][];
    /** A material slot per face; refined faces keep their parent's. */
    materials: number[];
    /** Edge sharpness by {@link edgeKey}; Infinity never softens. */
    creases: Map<number, number>;
    /** Points that never move, such as the corners of an open edge. */
    corners: Set<number>;
};

const KEY_SCALE = 4194304;

export function edgeKey(a: number, b: number): number {
    return a < b ? a * KEY_SCALE + b : b * KEY_SCALE + a;
}

export function emptyCage(attributeSize = 0): Cage {
    return {
        positions: [],
        attributes: [],
        attributeSize,
        faces: [],
        materials: [],
        creases: new Map(),
        corners: new Set(),
    };
}

/**
 * The working form of a cage: flat typed arrays, faces as runs of corners.
 */
type Mesh = {
    positions: Float64Array;
    attributes: Float64Array;
    k: number;
    faceStart: Int32Array;
    faceCorners: Int32Array;
    materials: Int32Array;
    creases: Map<number, number>;
    corners: Set<number>;
};

function toMesh(cage: Cage): Mesh {
    const faceStart = new Int32Array(cage.faces.length + 1);
    let total = 0;

    cage.faces.forEach((face, f) => {
        faceStart[f] = total;
        total += face.length;
    });
    faceStart[cage.faces.length] = total;

    const faceCorners = new Int32Array(total);
    let at = 0;

    for (const face of cage.faces) {
        for (const v of face) {
            faceCorners[at++] = v;
        }
    }

    return {
        positions: Float64Array.from(cage.positions),
        attributes: Float64Array.from(cage.attributes),
        k: cage.attributeSize,
        faceStart,
        faceCorners,
        materials: Int32Array.from(cage.materials),
        creases: cage.creases,
        corners: cage.corners,
    };
}

function toCage(mesh: Mesh): Cage {
    const faces: number[][] = [];
    const count = mesh.faceStart.length - 1;

    for (let f = 0; f < count; f++) {
        faces.push(
            Array.from(
                mesh.faceCorners.subarray(
                    mesh.faceStart[f],
                    mesh.faceStart[f + 1],
                ),
            ),
        );
    }

    return {
        positions: Array.from(mesh.positions),
        attributes: Array.from(mesh.attributes),
        attributeSize: mesh.k,
        faces,
        materials: Array.from(mesh.materials),
        creases: mesh.creases,
        corners: mesh.corners,
    };
}

export function subdivide(cage: Cage, levels: number): Cage {
    if (levels <= 0) {
        return cage;
    }

    let mesh = toMesh(cage);

    for (let level = 0; level < levels; level++) {
        mesh = subdivideOnce(mesh);
    }

    return toCage(mesh);
}

/**
 * A refined cage as flat arrays: after one level every face is a quad, so
 * the corners come four at a time.
 */
export type RefinedQuads = {
    positions: Float64Array;
    attributes: Float64Array;
    attributeSize: number;
    quads: Int32Array;
    materials: Int32Array;
};

/**
 * Subdivide without turning the result back into a cage of face arrays,
 * which for a whole car body is most of the work.
 */
export function subdivideQuads(cage: Cage, levels: number): RefinedQuads {
    let mesh = toMesh(cage);

    for (let level = 0; level < Math.max(1, levels); level++) {
        mesh = subdivideOnce(mesh);
    }

    return {
        positions: mesh.positions,
        attributes: mesh.attributes,
        attributeSize: mesh.k,
        quads: mesh.faceCorners,
        materials: mesh.materials,
    };
}

function subdivideOnce(mesh: Mesh): Mesh {
    const P = mesh.positions;
    const A = mesh.attributes;
    const k = mesh.k;
    const vertexCount = P.length / 3;
    const faceCount = mesh.faceStart.length - 1;
    const { faceStart, faceCorners } = mesh;
    const cornerCount = faceCorners.length;

    // Edges: bucket each face edge under its lower vertex, then pair the
    // matching ones in each bucket.
    const bucket = new Int32Array(vertexCount + 1);

    for (let f = 0; f < faceCount; f++) {
        const start = faceStart[f];
        const end = faceStart[f + 1];

        for (let c = start; c < end; c++) {
            const a = faceCorners[c];
            const b = faceCorners[c + 1 < end ? c + 1 : start];
            bucket[Math.min(a, b) + 1] += 1;
        }
    }

    for (let v = 1; v <= vertexCount; v++) {
        bucket[v] += bucket[v - 1];
    }

    const fill = bucket.slice(0, vertexCount);
    const slotOther = new Int32Array(cornerCount);
    const slotCorner = new Int32Array(cornerCount);
    const slotFace = new Int32Array(cornerCount);

    for (let f = 0; f < faceCount; f++) {
        const start = faceStart[f];
        const end = faceStart[f + 1];

        for (let c = start; c < end; c++) {
            const a = faceCorners[c];
            const b = faceCorners[c + 1 < end ? c + 1 : start];
            const slot = fill[Math.min(a, b)]++;
            slotOther[slot] = Math.max(a, b);
            slotCorner[slot] = c;
            slotFace[slot] = f;
        }
    }

    // The edge leaving each face corner, and per edge its ends and faces.
    const cornerEdge = new Int32Array(cornerCount);
    const edgeFrom: number[] = [];
    const edgeTo: number[] = [];
    const edgeFaceA: number[] = [];
    const edgeFaceB: number[] = [];
    const edgeSharpness: number[] = [];
    const taken = new Uint8Array(cornerCount);

    for (let v = 0; v < vertexCount; v++) {
        const start = bucket[v];
        const end = bucket[v + 1];

        for (let i = start; i < end; i++) {
            if (taken[i]) {
                continue;
            }

            const e = edgeFrom.length;
            const other = slotOther[i];
            edgeFrom.push(v);
            edgeTo.push(other);
            edgeFaceA.push(slotFace[i]);
            cornerEdge[slotCorner[i]] = e;
            let second = -1;
            let sharp = mesh.creases.get(edgeKey(v, other)) ?? 0;

            for (let j = i + 1; j < end; j++) {
                if (!taken[j] && slotOther[j] === other) {
                    taken[j] = 1;
                    cornerEdge[slotCorner[j]] = e;

                    if (second === -1) {
                        second = slotFace[j];
                    } else {
                        // Three faces on one edge: keep it as a hard seam.
                        sharp = Infinity;
                    }
                }
            }

            edgeFaceB.push(second);
            edgeSharpness.push(sharp);
        }
    }

    const edgeCount = edgeFrom.length;
    const total = vertexCount + edgeCount + faceCount;
    const NP = new Float64Array(total * 3);
    const NA = new Float64Array(total * k);
    const edgeBase = vertexCount;
    const faceBase = vertexCount + edgeCount;

    // Face points: the centroid of each face.
    for (let f = 0; f < faceCount; f++) {
        const start = faceStart[f];
        const end = faceStart[f + 1];
        const out = faceBase + f;
        const inverse = 1 / (end - start);

        for (let c = start; c < end; c++) {
            const v = faceCorners[c];
            NP[out * 3] += P[v * 3] * inverse;
            NP[out * 3 + 1] += P[v * 3 + 1] * inverse;
            NP[out * 3 + 2] += P[v * 3 + 2] * inverse;

            for (let a = 0; a < k; a++) {
                NA[out * k + a] += A[v * k + a] * inverse;
            }
        }
    }

    // Edge points: the midpoint on a sharp or open edge, otherwise the
    // average of the two ends and the two face points.
    for (let e = 0; e < edgeCount; e++) {
        const a = edgeFrom[e];
        const b = edgeTo[e];
        const out = edgeBase + e;
        const open = edgeFaceB[e] === -1;
        const hard = open ? 1 : Math.min(1, edgeSharpness[e]);
        const fa = faceBase + edgeFaceA[e];
        const fb = open ? fa : faceBase + edgeFaceB[e];

        for (let c = 0; c < 3; c++) {
            const mid = (P[a * 3 + c] + P[b * 3 + c]) / 2;
            const smooth = open
                ? mid
                : (P[a * 3 + c] +
                      P[b * 3 + c] +
                      NP[fa * 3 + c] +
                      NP[fb * 3 + c]) /
                  4;
            NP[out * 3 + c] = smooth + (mid - smooth) * hard;
        }

        for (let c = 0; c < k; c++) {
            const mid = (A[a * k + c] + A[b * k + c]) / 2;
            const smooth = open
                ? mid
                : (A[a * k + c] +
                      A[b * k + c] +
                      NA[fa * k + c] +
                      NA[fb * k + c]) /
                  4;
            NA[out * k + c] = smooth + (mid - smooth) * hard;
        }
    }

    // Everything each vertex touches.
    const valence = new Int32Array(vertexCount);
    const faceTouches = new Int32Array(vertexCount);
    const faceSum = new Float64Array(vertexCount * 3);
    const faceSumA = new Float64Array(vertexCount * k);
    const edgeSum = new Float64Array(vertexCount * 3);
    const edgeSumA = new Float64Array(vertexCount * k);
    const sharpCount = new Int32Array(vertexCount);
    const sharpTotal = new Float64Array(vertexCount);
    const sharpEnds = new Int32Array(vertexCount * 2);

    for (let e = 0; e < edgeCount; e++) {
        const open = edgeFaceB[e] === -1;
        const sharpness = open ? Infinity : edgeSharpness[e];

        for (let side = 0; side < 2; side++) {
            const v = side === 0 ? edgeFrom[e] : edgeTo[e];
            const other = side === 0 ? edgeTo[e] : edgeFrom[e];
            valence[v] += 1;

            for (let c = 0; c < 3; c++) {
                edgeSum[v * 3 + c] += (P[v * 3 + c] + P[other * 3 + c]) / 2;
            }

            for (let c = 0; c < k; c++) {
                edgeSumA[v * k + c] += (A[v * k + c] + A[other * k + c]) / 2;
            }

            if (sharpness > 0) {
                if (sharpCount[v] < 2) {
                    sharpEnds[v * 2 + sharpCount[v]] = other;
                }

                sharpCount[v] += 1;
                sharpTotal[v] += Math.min(sharpness, 1000);
            }
        }
    }

    for (let f = 0; f < faceCount; f++) {
        const fp = faceBase + f;

        for (let c = faceStart[f]; c < faceStart[f + 1]; c++) {
            const v = faceCorners[c];
            faceTouches[v] += 1;

            for (let a = 0; a < 3; a++) {
                faceSum[v * 3 + a] += NP[fp * 3 + a];
            }

            for (let a = 0; a < k; a++) {
                faceSumA[v * k + a] += NA[fp * k + a];
            }
        }
    }

    // Vertex points: smooth, crease or corner rules.
    for (let v = 0; v < vertexCount; v++) {
        const n = valence[v];
        const interior = faceTouches[v] === n && n >= 3;
        const creases = sharpCount[v];
        const vertexSharpness =
            creases > 0 ? Math.min(1, sharpTotal[v] / creases) : 0;
        const corner = mesh.corners.has(v) || creases > 2 || n < 2;
        const x = sharpEnds[v * 2];
        const y = sharpEnds[v * 2 + 1];

        for (let c = 0; c < 3 + k; c++) {
            const source = c < 3 ? P : A;
            const stride = c < 3 ? 3 : k;
            const channel = c < 3 ? c : c - 3;
            const target = c < 3 ? NP : NA;
            const faces = c < 3 ? faceSum : faceSumA;
            const edges = c < 3 ? edgeSum : edgeSumA;
            const value = source[v * stride + channel];
            let result = value;

            if (!corner) {
                const smooth = interior
                    ? (faces[v * stride + channel] / n +
                          (2 * edges[v * stride + channel]) / n +
                          (n - 3) * value) /
                      n
                    : value;

                if (creases === 2) {
                    const crease =
                        (source[x * stride + channel] +
                            6 * value +
                            source[y * stride + channel]) /
                        8;
                    result = interior
                        ? smooth + (crease - smooth) * vertexSharpness
                        : crease;
                } else {
                    result = smooth;
                }
            }

            target[v * stride + channel] = result;
        }
    }

    // Each face becomes one quad per corner.
    const newStart = new Int32Array(cornerCount + 1);
    const newCorners = new Int32Array(cornerCount * 4);
    const newMaterials = new Int32Array(cornerCount);
    let quad = 0;

    for (let f = 0; f < faceCount; f++) {
        const start = faceStart[f];
        const end = faceStart[f + 1];

        for (let c = start; c < end; c++) {
            const previous = c === start ? end - 1 : c - 1;
            newStart[quad] = quad * 4;
            newCorners[quad * 4] = faceCorners[c];
            newCorners[quad * 4 + 1] = edgeBase + cornerEdge[c];
            newCorners[quad * 4 + 2] = faceBase + f;
            newCorners[quad * 4 + 3] = edgeBase + cornerEdge[previous];
            newMaterials[quad] = mesh.materials[f];
            quad += 1;
        }
    }

    newStart[cornerCount] = cornerCount * 4;

    // Creases carry on into both halves of their edge, one level softer.
    const creases = new Map<number, number>();

    for (let e = 0; e < edgeCount; e++) {
        const sharpness = edgeSharpness[e];

        if (sharpness > 0 && edgeFaceB[e] !== -1) {
            const next = sharpness === Infinity ? Infinity : sharpness - 1;

            if (next > 0) {
                creases.set(edgeKey(edgeFrom[e], edgeBase + e), next);
                creases.set(edgeKey(edgeBase + e, edgeTo[e]), next);
            }
        }
    }

    return {
        positions: NP,
        attributes: NA,
        k,
        faceStart: newStart,
        faceCorners: newCorners,
        materials: newMaterials,
        creases,
        corners: new Set(mesh.corners),
    };
}
