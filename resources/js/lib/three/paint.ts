/**
 * How a vehicle's paint should look, worked out from whatever was typed
 * into its colour field: "White", "Soul Red Crystal Metallic", "Midnight
 * Black Mica", "#1f4e79". Unknown or missing colours fall back to a
 * gunmetal grey metallic that shows the shape well in both themes.
 */
export type PaintFinish = {
    /** sRGB hex of the base coat. */
    hex: string;
    /** 0 for a solid colour, up to 1 for a heavy metallic. */
    metallic: number;
    /** Pearl and mica paints shift colour slightly with angle. */
    pearl: boolean;
    /** Matte and satin paints have no gloss clear coat. */
    matte: boolean;
    /** The name shown back, cleaned up. */
    name: string;
};

type Shade = { hex: string; metallic?: number };

/**
 * Base colours as car paint actually comes, not as a web page draws them:
 * reds are deep, whites are warm, silvers are darker than they look.
 */
const SHADES: Record<string, Shade> = {
    white: { hex: '#eeeeea' },
    ivory: { hex: '#ece6d2' },
    cream: { hex: '#e9e0c4' },
    pearl: { hex: '#ecebe4' },
    black: { hex: '#0c0d0f' },
    silver: { hex: '#a9aeb3', metallic: 0.9 },
    grey: { hex: '#5f6469', metallic: 0.5 },
    gray: { hex: '#5f6469', metallic: 0.5 },
    graphite: { hex: '#3b3e42', metallic: 0.7 },
    gunmetal: { hex: '#44494e', metallic: 0.8 },
    charcoal: { hex: '#2e3134', metallic: 0.5 },
    titanium: { hex: '#8c8e8c', metallic: 0.85 },
    platinum: { hex: '#b3b4b0', metallic: 0.9 },
    aluminium: { hex: '#b6b9bb', metallic: 0.95 },
    aluminum: { hex: '#b6b9bb', metallic: 0.95 },
    red: { hex: '#9b1016' },
    maroon: { hex: '#4d0e16' },
    burgundy: { hex: '#4a1020' },
    wine: { hex: '#4a1020' },
    crimson: { hex: '#8e0d1d' },
    ruby: { hex: '#7a0c1c', metallic: 0.5 },
    cherry: { hex: '#8a0f1c' },
    scarlet: { hex: '#b1141a' },
    blue: { hex: '#173a78' },
    navy: { hex: '#141f3a' },
    cobalt: { hex: '#1b3f9a', metallic: 0.5 },
    sapphire: { hex: '#10306a', metallic: 0.6 },
    azure: { hex: '#2f6fb8' },
    sky: { hex: '#6c9fd0' },
    teal: { hex: '#1a6168' },
    turquoise: { hex: '#1e8a8f' },
    aqua: { hex: '#3aa3a8' },
    green: { hex: '#1f4f2e' },
    emerald: { hex: '#0f5a3a', metallic: 0.5 },
    olive: { hex: '#4e5233' },
    khaki: { hex: '#80794f' },
    lime: { hex: '#8fbf2a' },
    mint: { hex: '#9fd3b6' },
    yellow: { hex: '#e3b21a' },
    mustard: { hex: '#c09020' },
    lemon: { hex: '#e8d23a' },
    gold: { hex: '#a9884c', metallic: 0.85 },
    orange: { hex: '#cf5413' },
    tangerine: { hex: '#d9601c' },
    copper: { hex: '#9a5a36', metallic: 0.8 },
    bronze: { hex: '#7c5a36', metallic: 0.8 },
    brown: { hex: '#46301f' },
    chocolate: { hex: '#3a2519' },
    tan: { hex: '#a88a61' },
    beige: { hex: '#c7b797' },
    sand: { hex: '#c3ad84' },
    champagne: { hex: '#c9b893', metallic: 0.8 },
    purple: { hex: '#3d2458' },
    violet: { hex: '#4f2f7a' },
    plum: { hex: '#4a2240' },
    pink: { hex: '#d58aa1' },
    magenta: { hex: '#9c1f6b' },
};

/**
 * Words from paint brochures that stand for a base colour.
 */
const ALIASES: Record<string, string> = {
    arctic: 'white',
    alpine: 'white',
    glacier: 'white',
    snow: 'white',
    frost: 'white',
    frozen: 'white',
    polar: 'white',
    oxford: 'white',
    chalk: 'white',
    porcelain: 'white',
    onyx: 'black',
    ebony: 'black',
    obsidian: 'black',
    jet: 'black',
    phantom: 'black',
    panther: 'black',
    raven: 'black',
    midnight: 'black',
    shadow: 'black',
    carbon: 'graphite',
    magnetic: 'graphite',
    slate: 'grey',
    granite: 'grey',
    storm: 'grey',
    steel: 'grey',
    cement: 'grey',
    ash: 'grey',
    ingot: 'silver',
    sterling: 'silver',
    mercury: 'silver',
    quicksilver: 'silver',
    chrome: 'silver',
    flame: 'red',
    fire: 'red',
    race: 'red',
    rosso: 'red',
    garnet: 'burgundy',
    ocean: 'blue',
    marine: 'blue',
    lightning: 'blue',
    velocity: 'blue',
    indigo: 'navy',
    forest: 'green',
    jungle: 'green',
    racing: 'green',
    jade: 'emerald',
    sunset: 'orange',
    mango: 'orange',
    amber: 'orange',
    sunburst: 'yellow',
    desert: 'sand',
    mocha: 'brown',
    coffee: 'brown',
    espresso: 'chocolate',
    cognac: 'bronze',
};

const FALLBACK: PaintFinish = {
    hex: '#474c52',
    metallic: 0.8,
    pearl: false,
    matte: false,
    name: 'Gunmetal',
};

function hexToRgb(hex: string): [number, number, number] {
    const value = parseInt(hex.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
    const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

    return `#${[r, g, b]
        .map((v) => clampByte(v).toString(16).padStart(2, '0'))
        .join('')}`;
}

function mix(
    a: [number, number, number],
    b: [number, number, number],
    t: number,
): [number, number, number] {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

/**
 * Parse a CSS colour the browser understands ("tomato", "rgb(…)") when no
 * paint word matched.
 */
function cssColour(text: string): string | null {
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) {
        return text.length === 4
            ? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`
            : text;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    const context = document.createElement('canvas').getContext('2d');

    if (!context) {
        return null;
    }

    context.fillStyle = '#010203';
    context.fillStyle = text;
    const parsed = String(context.fillStyle);

    return parsed === '#010203' || !parsed.startsWith('#') ? null : parsed;
}

export function paintFinish(colour: string | null | undefined): PaintFinish {
    const text = (colour ?? '').trim();

    if (text === '') {
        return FALLBACK;
    }

    const lower = text.toLowerCase();
    const words = lower.split(/[^a-z#0-9]+/).filter(Boolean);
    const has = (...list: string[]) =>
        list.some((word) => words.includes(word));

    const pearl = has('pearl', 'pearlescent', 'mica', 'tricoat', 'crystal');
    const matte = has('matte', 'matt', 'satin', 'frozen', 'flat');
    const metallicWord = has('metallic', 'metal', 'met', 'mica', 'flake');

    // Two-word colours first ("light blue"), then single words, then the
    // brochure aliases.
    let base: Shade | null = null;
    let baseName = '';

    for (const word of words) {
        if (SHADES[word] && (base === null || word !== 'pearl')) {
            base = SHADES[word];
            baseName = word;
        }
    }

    if (!base) {
        for (const word of words) {
            if (ALIASES[word]) {
                base = SHADES[ALIASES[word]];
                baseName = ALIASES[word];
                break;
            }
        }
    }

    if (!base) {
        const parsed = cssColour(lower.replace(/\s+/g, ''));

        if (!parsed) {
            return { ...FALLBACK, name: text };
        }

        base = { hex: parsed };
        baseName = text;
    }

    let rgb = hexToRgb(base.hex);

    if (has('dark', 'deep', 'midnight')) {
        rgb = mix(rgb, [0, 0, 0], 0.45);
    }

    if (has('light', 'pale', 'pastel', 'baby', 'sky')) {
        rgb = mix(rgb, [235, 235, 235], 0.45);
    }

    if (has('bright', 'vivid', 'electric', 'neon')) {
        const max = Math.max(...rgb);
        rgb = rgb.map((v) => v + (v - max * 0.5) * 0.25) as [
            number,
            number,
            number,
        ];
    }

    // A white pearl reads slightly warm; a grey called "silver" is lighter.
    if (baseName === 'white' && pearl) {
        rgb = mix(rgb, [236, 232, 220], 0.4);
    }

    const metallic = matte
        ? Math.max(base.metallic ?? 0, metallicWord ? 0.6 : 0)
        : metallicWord
          ? Math.max(0.6, base.metallic ?? 0)
          : (base.metallic ?? 0);

    return {
        hex: rgbToHex(rgb),
        metallic,
        pearl,
        matte,
        name: text,
    };
}
