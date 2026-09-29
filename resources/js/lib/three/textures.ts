import * as THREE from 'three';

/**
 * Textures drawn on a canvas at run time: the writing moulded into a tyre
 * wall, the sipes cut across a tread, a number plate. Only available in a
 * browser; everywhere else they come back null and the surface is plain.
 */
const cache = new Map<string, THREE.Texture>();

function canvas(
    width: number,
    height: number,
): {
    element: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
} | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;
    const context = element.getContext('2d');

    return context ? { element, context } : null;
}

function remember(
    key: string,
    make: () => THREE.Texture | null,
): THREE.Texture | null {
    const existing = cache.get(key);

    if (existing) {
        return existing;
    }

    const texture = make();

    if (texture) {
        cache.set(key, texture);
    }

    return texture;
}

/**
 * Release every texture drawn so far. Called when the last viewer goes.
 */
export function disposeTextures(): void {
    for (const texture of cache.values()) {
        texture.dispose();
    }

    cache.clear();
}

/**
 * A bump map for a tyre's outer wall, unrolled: across is round the tyre,
 * down is from the tread to the rim. The size and the usual markings are
 * raised in a band a third of the way down, twice round.
 */
export function sidewallTexture(
    size: string,
    extra: string,
): THREE.Texture | null {
    return remember(`sidewall:${size}:${extra}`, () => {
        const surface = canvas(4096, 256);

        if (!surface) {
            return null;
        }

        const { element, context } = surface;
        context.fillStyle = '#000';
        context.fillRect(0, 0, element.width, element.height);
        context.fillStyle = '#fff';
        context.textBaseline = 'middle';

        const half = element.width / 2;

        for (const offset of [0, half]) {
            context.font = 'bold 74px Arial, Helvetica, sans-serif';
            context.fillText(size, offset + 180, 110);
            context.font = 'bold 40px Arial, Helvetica, sans-serif';
            context.fillText(extra, offset + 1080, 104);
            context.fillText('RADIAL TUBELESS', offset + 1480, 104);
            context.font = '26px Arial, Helvetica, sans-serif';
            context.fillText('DOT 7X2K 4R9 3824', offset + 760, 178);
            context.fillText(
                'MAX LOAD 750 KG (1653 LBS)  MAX PRESS 350 KPA (51 PSI)',
                offset + 1000,
                178,
            );

            // Tread-wear indicator arrows.
            for (const x of [offset + 120, offset + 1880]) {
                context.beginPath();
                context.moveTo(x, 20);
                context.lineTo(x + 18, 48);
                context.lineTo(x - 18, 48);
                context.closePath();
                context.fill();
            }
        }

        // A fine ring of rib lines near the rim, as moulded.
        context.fillStyle = 'rgba(255,255,255,0.55)';

        for (let i = 0; i < 4; i++) {
            context.fillRect(0, 214 + i * 9, element.width, 3);
        }

        // The top of the canvas is the tread edge of the wall.
        const texture = new THREE.CanvasTexture(element);
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.anisotropy = 8;

        return texture;
    });
}

/**
 * A bump map for a road tyre's tread face: sipes and shoulder slots, one
 * pitch wide, repeated round the tyre.
 */
export function treadTexture(
    kind: 'road' | 'truck' | 'turf',
): THREE.Texture | null {
    return remember(`tread:${kind}`, () => {
        const surface = canvas(256, 512);

        if (!surface) {
            return null;
        }

        const { element, context } = surface;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, element.width, element.height);
        context.strokeStyle = '#000';
        context.fillStyle = '#000';
        const h = element.height;
        const w = element.width;

        if (kind === 'turf') {
            for (let i = 0; i < 6; i++) {
                const y = (h / 6) * i + h / 12;
                context.beginPath();
                context.moveTo(0, y);
                context.lineTo(w / 2, y + h / 16);
                context.lineTo(w, y);
                context.lineWidth = 22;
                context.stroke();
            }
        } else {
            // Shoulder slots across the outer ribs.
            context.lineWidth = kind === 'truck' ? 10 : 14;

            for (const [from, to] of [
                [0, 0.13],
                [0.87, 1],
            ]) {
                context.beginPath();
                context.moveTo(w * 0.5, h * from);
                context.lineTo(w * 0.5, h * to);
                context.stroke();
            }

            // Angled sipes across the inner ribs.
            context.lineWidth = 3;

            for (const [from, to] of [
                [0.2, 0.3],
                [0.4, 0.6],
                [0.7, 0.8],
            ]) {
                for (const x of [0.2, 0.65]) {
                    context.beginPath();
                    context.moveTo(w * x, h * from);
                    context.lineTo(w * (x + 0.18), h * to);
                    context.stroke();
                }
            }
        }

        const texture = new THREE.CanvasTexture(element);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = 8;

        return texture;
    });
}

/**
 * A number plate: white reflective face, a thin border and the
 * registration in black. Without a registration it shows a blank plate.
 */
export function plateTexture(
    registration: string | null,
): THREE.Texture | null {
    const text = (registration ?? '').toUpperCase().slice(0, 9);

    return remember(`plate:${text}`, () => {
        const surface = canvas(1040, 220);

        if (!surface) {
            return null;
        }

        const { element, context } = surface;
        const gradient = context.createLinearGradient(0, 0, 0, element.height);
        gradient.addColorStop(0, '#fbfbf8');
        gradient.addColorStop(1, '#ecece6');
        context.fillStyle = gradient;
        context.fillRect(0, 0, element.width, element.height);
        context.strokeStyle = '#1b1c1e';
        context.lineWidth = 8;
        context.strokeRect(10, 10, element.width - 20, element.height - 20);

        if (text) {
            context.fillStyle = '#16171a';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.font =
                'bold 150px "Arial Narrow", Arial, Helvetica, sans-serif';
            context.fillText(
                text,
                element.width / 2,
                element.height / 2 + 6,
                element.width - 90,
            );
        }

        const texture = new THREE.CanvasTexture(element);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;

        return texture;
    });
}

/**
 * A fine hexagonal mesh for grille inserts, as an alpha map: white is
 * plastic, black is the hole.
 */
export function meshTexture(): THREE.Texture | null {
    return remember('mesh', () => {
        const surface = canvas(256, 256);

        if (!surface) {
            return null;
        }

        const { element, context } = surface;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 256, 256);
        context.fillStyle = '#000';
        const size = 32;
        const h = (size * Math.sqrt(3)) / 2;

        for (let row = -1; row < 256 / h + 1; row++) {
            for (let col = -1; col < 256 / size + 1; col++) {
                const cx = col * size + (row % 2 === 0 ? 0 : size / 2);
                const cy = row * h;
                context.beginPath();

                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i + Math.PI / 6;
                    const x = cx + Math.cos(a) * size * 0.43;
                    const y = cy + Math.sin(a) * size * 0.43;

                    if (i === 0) {
                        context.moveTo(x, y);
                    } else {
                        context.lineTo(x, y);
                    }
                }

                context.closePath();
                context.fill();
            }
        }

        const texture = new THREE.CanvasTexture(element);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        return texture;
    });
}
