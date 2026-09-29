/**
 * A smooth function through [x, value] keys that never overshoots them
 * (monotone cubic Hermite). Body lines drawn this way bend where the keys
 * say and stay straight where they say, the way a designer's sweeps do.
 */
export function smoothCurve(keys: [number, number][]): (x: number) => number {
    const points = [...keys].sort((a, b) => a[0] - b[0]);
    const n = points.length;

    if (n === 0) {
        return () => 0;
    }

    if (n === 1) {
        return () => points[0][1];
    }

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const slopes: number[] = [];

    for (let i = 0; i < n - 1; i++) {
        slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1e-9));
    }

    const tangents = Array.from({ length: n }, () => 0);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i++) {
        tangents[i] =
            slopes[i - 1] * slopes[i] <= 0
                ? 0
                : (slopes[i - 1] + slopes[i]) / 2;
    }

    for (let i = 0; i < n - 1; i++) {
        if (slopes[i] === 0) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
            continue;
        }

        const a = tangents[i] / slopes[i];
        const b = tangents[i + 1] / slopes[i];
        const length = a * a + b * b;

        if (length > 9) {
            const t = 3 / Math.sqrt(length);
            tangents[i] = t * a * slopes[i];
            tangents[i + 1] = t * b * slopes[i];
        }
    }

    return (x: number) => {
        if (x <= xs[0]) {
            return ys[0];
        }

        if (x >= xs[n - 1]) {
            return ys[n - 1];
        }

        let i = 0;

        while (i < n - 2 && x > xs[i + 1]) {
            i += 1;
        }

        const h = xs[i + 1] - xs[i];
        const t = (x - xs[i]) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        return (
            (2 * t3 - 3 * t2 + 1) * ys[i] +
            (t3 - 2 * t2 + t) * h * tangents[i] +
            (-2 * t3 + 3 * t2) * ys[i + 1] +
            (t3 - t2) * h * tangents[i + 1]
        );
    };
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function clamp01(t: number): number {
    return Math.min(1, Math.max(0, t));
}

/**
 * Hermite smoothstep between two edges.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01((x - edge0) / (edge1 - edge0));

    return t * t * (3 - 2 * t);
}

/**
 * Signed distance from a point to a closed polygon: negative inside.
 */
export function polygonDistance(
    x: number,
    y: number,
    polygon: [number, number][],
): number {
    let inside = false;
    let best = Infinity;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }

        const dx = xj - xi;
        const dy = yj - yi;
        const t = clamp01(
            ((x - xi) * dx + (y - yi) * dy) / (dx * dx + dy * dy || 1),
        );
        best = Math.min(best, Math.hypot(x - (xi + dx * t), y - (yi + dy * t)));
    }

    return inside ? -best : best;
}

/**
 * Signed distance to a rounded rectangle centred on (cx, cy).
 */
export function roundedBoxDistance(
    x: number,
    y: number,
    cx: number,
    cy: number,
    halfWidth: number,
    halfHeight: number,
    radius: number,
): number {
    const qx = Math.abs(x - cx) - halfWidth + radius;
    const qy = Math.abs(y - cy) - halfHeight + radius;

    return (
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        radius
    );
}

/**
 * Round the corners of a polygon by replacing each corner with an arc.
 */
export function roundPolygon(
    polygon: [number, number][],
    radius: number,
    segments = 5,
): [number, number][] {
    const result: [number, number][] = [];
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
        const [px, py] = polygon[(i - 1 + n) % n];
        const [cx, cy] = polygon[i];
        const [nx, ny] = polygon[(i + 1) % n];
        const inLength = Math.hypot(cx - px, cy - py);
        const outLength = Math.hypot(nx - cx, ny - cy);
        const turn = Math.abs(
            ((cx - px) * (ny - cy) - (cy - py) * (nx - cx)) /
                (inLength * outLength || 1),
        );

        // Points along a gentle curve need no rounding of their own.
        if (turn < 0.25) {
            result.push([cx, cy]);
            continue;
        }
        const r = Math.min(radius, inLength / 2, outLength / 2);
        const ax = cx + ((px - cx) / inLength) * r;
        const ay = cy + ((py - cy) / inLength) * r;
        const bx = cx + ((nx - cx) / outLength) * r;
        const by = cy + ((ny - cy) / outLength) * r;

        for (let s = 0; s <= segments; s++) {
            const t = s / segments;
            // Quadratic Bezier through the corner.
            const x =
                (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
            const y =
                (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
            result.push([x, y]);
        }
    }

    return result;
}
