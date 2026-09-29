import * as THREE from 'three';
import { paintFinish, type PaintFinish } from '@/lib/three/paint';
import {
    addPatch,
    withDetail,
    withFlake,
    withSpangle,
} from '@/lib/three/shading';

/**
 * Every surface a machine is made of, physically based and tuned against
 * the studio reflections: clear-coated paint in the vehicle's own colour,
 * transmissive glass and lenses, grained plastics, sand-cast iron, machined
 * alloy, rubber that is not quite black.
 */
export type Materials = {
    finish: PaintFinish;
    paint: THREE.MeshPhysicalMaterial;
    /** Piano-black trim: pillars, grille surrounds, mirror caps. */
    gloss: THREE.MeshPhysicalMaterial;
    /** Moulded black plastic with a grain. */
    plastic: THREE.MeshStandardMaterial;
    /** Rough unpainted plastic for arch liners and the underbody. */
    liner: THREE.MeshStandardMaterial;
    rubber: THREE.MeshStandardMaterial;
    tyre: THREE.MeshStandardMaterial;
    glass: THREE.MeshPhysicalMaterial;
    privacyGlass: THREE.MeshPhysicalMaterial;
    lens: THREE.MeshPhysicalMaterial;
    redLens: THREE.MeshPhysicalMaterial;
    amberLens: THREE.MeshPhysicalMaterial;
    chrome: THREE.MeshStandardMaterial;
    satin: THREE.MeshStandardMaterial;
    reflector: THREE.MeshStandardMaterial;
    led: THREE.MeshStandardMaterial;
    mirror: THREE.MeshStandardMaterial;
    plate: THREE.MeshStandardMaterial;
    underbody: THREE.MeshStandardMaterial;
    /** Machined face of an alloy wheel. */
    alloy: THREE.MeshStandardMaterial;
    /** Painted pockets and spoke sides of an alloy wheel. */
    alloyPaint: THREE.MeshPhysicalMaterial;
    /** A painted steel wheel. */
    steelWheel: THREE.MeshPhysicalMaterial;
    disc: THREE.MeshStandardMaterial;
    caliper: THREE.MeshPhysicalMaterial;
    castIron: THREE.MeshStandardMaterial;
    castAluminium: THREE.MeshStandardMaterial;
    polished: THREE.MeshStandardMaterial;
    steel: THREE.MeshStandardMaterial;
    zinc: THREE.MeshStandardMaterial;
    /** Hot-dip galvanised steel, spangled: trailers, farm gear. */
    galvanised: THREE.MeshStandardMaterial;
    stainless: THREE.MeshStandardMaterial;
    exhaust: THREE.MeshStandardMaterial;
    copper: THREE.MeshStandardMaterial;
    brass: THREE.MeshStandardMaterial;
    engineCover: THREE.MeshStandardMaterial;
    crinkle: THREE.MeshStandardMaterial;
    hose: THREE.MeshStandardMaterial;
    belt: THREE.MeshStandardMaterial;
    wire: THREE.MeshStandardMaterial;
    translucent: THREE.MeshPhysicalMaterial;
    yellow: THREE.MeshStandardMaterial;
    orange: THREE.MeshStandardMaterial;
    red: THREE.MeshStandardMaterial;
    blue: THREE.MeshStandardMaterial;
    seat: THREE.MeshStandardMaterial;
    dash: THREE.MeshStandardMaterial;
    /** White painted sheet, as on a truck's freight box. */
    panel: THREE.MeshPhysicalMaterial;
    headliner: THREE.MeshStandardMaterial;
    carpet: THREE.MeshStandardMaterial;
    cabin: THREE.MeshStandardMaterial;
    /** A darker body colour for things like tractor chassis and wheel centres. */
    paintDark: THREE.MeshPhysicalMaterial;
    /** An industrial enamel, for machines that come in a maker's colour. */
    enamel: THREE.MeshPhysicalMaterial;
};

export type MaterialOptions = {
    colour?: string | null;
    /** The enamel colour for tractors, mowers and gensets. */
    enamel?: string;
};

function paintMaterial(finish: PaintFinish): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(finish.hex),
        metalness: finish.metallic * 0.72,
        roughness: finish.matte
            ? 0.48
            : finish.metallic > 0
              ? 0.28 + finish.metallic * 0.12
              : 0.2,
        clearcoat: finish.matte ? 0 : 1,
        clearcoatRoughness: 0.03,
    });

    if (finish.pearl) {
        material.iridescence = 0.35;
        material.iridescenceIOR = 1.35;
        material.iridescenceThicknessRange = [260, 480];
    }

    if (finish.metallic > 0.15) {
        withFlake(material, 0.22 + finish.metallic * 0.18);
    }

    return material;
}

/**
 * Glass over a see-through canvas would let the page behind show through
 * untinted, so it keeps at least this much cover wherever nothing is
 * behind it: dark glass stays dark against a white page.
 */
function withTint<T extends THREE.Material>(material: T, cover: number): T {
    addPatch(material, {
        key: `tint:${cover}`,
        apply(shader) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `#ifdef USE_TRANSMISSION
                    material.transmissionAlpha = max(material.transmissionAlpha, ${cover.toFixed(3)});
                #endif
                #include <opaque_fragment>`,
            );
        },
    });

    return material;
}

export function makeMaterials(options: MaterialOptions = {}): Materials {
    const finish = paintFinish(options.colour);
    const paint = paintMaterial(finish);
    const paintDarkColour = new THREE.Color(finish.hex).multiplyScalar(0.45);

    return {
        finish,
        paint,
        paintDark: new THREE.MeshPhysicalMaterial({
            color: paintDarkColour,
            metalness: finish.metallic * 0.6,
            roughness: 0.35,
            clearcoat: 0.8,
            clearcoatRoughness: 0.06,
        }),
        enamel: new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(options.enamel ?? finish.hex),
            metalness: 0.05,
            roughness: 0.32,
            clearcoat: 0.6,
            clearcoatRoughness: 0.12,
        }),
        gloss: new THREE.MeshPhysicalMaterial({
            color: 0x060708,
            metalness: 0,
            roughness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
        }),
        plastic: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x18191b,
                metalness: 0,
                roughness: 0.68,
            }),
            { frequency: 1400, slope: 0.12, roughness: 0.25 },
        ),
        liner: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x111213,
                metalness: 0,
                roughness: 0.92,
            }),
            { frequency: 700, slope: 0.3, roughness: 0.2 },
        ),
        rubber: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x0f1011,
                metalness: 0,
                roughness: 0.82,
            }),
            { frequency: 2000, slope: 0.08 },
        ),
        tyre: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x161718,
                metalness: 0,
                roughness: 0.86,
            }),
            { frequency: 1800, slope: 0.1, roughness: 0.15 },
        ),
        glass: withTint(
            new THREE.MeshPhysicalMaterial({
                color: 0xbfcac5,
                metalness: 0,
                roughness: 0,
                transmission: 1,
                thickness: 0.005,
                ior: 1.52,
                specularIntensity: 1,
            }),
            0.34,
        ),
        privacyGlass: withTint(
            new THREE.MeshPhysicalMaterial({
                color: 0x2b3034,
                metalness: 0,
                roughness: 0,
                transmission: 1,
                thickness: 0.005,
                ior: 1.52,
            }),
            0.78,
        ),
        lens: new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.02,
            transmission: 1,
            thickness: 0.003,
            ior: 1.58,
        }),
        redLens: new THREE.MeshPhysicalMaterial({
            color: 0xb3121d,
            metalness: 0,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.004,
            ior: 1.5,
            clearcoat: 1,
        }),
        amberLens: new THREE.MeshPhysicalMaterial({
            color: 0xff8a14,
            metalness: 0,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.004,
            ior: 1.5,
        }),
        chrome: new THREE.MeshStandardMaterial({
            color: 0xe8eaec,
            metalness: 1,
            roughness: 0.04,
        }),
        satin: new THREE.MeshStandardMaterial({
            color: 0xc2c5c8,
            metalness: 1,
            roughness: 0.3,
        }),
        reflector: new THREE.MeshStandardMaterial({
            color: 0xd8dadd,
            metalness: 1,
            roughness: 0.12,
        }),
        led: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xeaf2ff,
            emissiveIntensity: 2.4,
            roughness: 0.4,
        }),
        mirror: new THREE.MeshStandardMaterial({
            color: 0xf0f2f4,
            metalness: 1,
            roughness: 0.01,
        }),
        plate: new THREE.MeshStandardMaterial({
            color: 0xf2f2ee,
            metalness: 0,
            roughness: 0.38,
        }),
        underbody: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x151617,
                metalness: 0.1,
                roughness: 0.9,
            }),
            { frequency: 500, slope: 0.25 },
        ),
        alloy: new THREE.MeshStandardMaterial({
            color: 0xd6d9dc,
            metalness: 1,
            roughness: 0.2,
        }),
        alloyPaint: new THREE.MeshPhysicalMaterial({
            color: 0x2c2f33,
            metalness: 0.6,
            roughness: 0.34,
            clearcoat: 0.7,
            clearcoatRoughness: 0.08,
        }),
        steelWheel: new THREE.MeshPhysicalMaterial({
            color: 0x9ea2a6,
            metalness: 0.7,
            roughness: 0.38,
            clearcoat: 0.5,
            clearcoatRoughness: 0.12,
        }),
        disc: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x7a7c7f,
                metalness: 0.95,
                roughness: 0.36,
            }),
            { frequency: 900, slope: 0.08, roughness: 0.4 },
        ),
        caliper: new THREE.MeshPhysicalMaterial({
            color: 0x2f3237,
            metalness: 0.35,
            roughness: 0.42,
            clearcoat: 0.4,
        }),
        castIron: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x3d3f41,
                metalness: 0.55,
                roughness: 0.7,
            }),
            { frequency: 650, slope: 0.35, roughness: 0.3 },
        ),
        castAluminium: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x9da1a5,
                metalness: 0.85,
                roughness: 0.46,
            }),
            { frequency: 800, slope: 0.28, roughness: 0.3 },
        ),
        polished: new THREE.MeshStandardMaterial({
            color: 0xd3d6d9,
            metalness: 1,
            roughness: 0.14,
        }),
        steel: new THREE.MeshStandardMaterial({
            color: 0xa9acae,
            metalness: 0.9,
            roughness: 0.36,
        }),
        zinc: new THREE.MeshStandardMaterial({
            color: 0xbdb49a,
            metalness: 0.85,
            roughness: 0.32,
        }),
        galvanised: withSpangle(
            new THREE.MeshStandardMaterial({
                color: 0xb9bec1,
                metalness: 0.65,
                roughness: 0.42,
            }),
        ),
        stainless: new THREE.MeshStandardMaterial({
            color: 0xb0b3b5,
            metalness: 1,
            roughness: 0.26,
        }),
        exhaust: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x5a4d45,
                metalness: 0.75,
                roughness: 0.6,
            }),
            { frequency: 500, slope: 0.3, roughness: 0.4 },
        ),
        copper: new THREE.MeshStandardMaterial({
            color: 0xb56b40,
            metalness: 1,
            roughness: 0.34,
        }),
        brass: new THREE.MeshStandardMaterial({
            color: 0xc9a44f,
            metalness: 1,
            roughness: 0.3,
        }),
        engineCover: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x1b1c1e,
                metalness: 0.05,
                roughness: 0.52,
            }),
            { frequency: 1600, slope: 0.1, roughness: 0.2 },
        ),
        crinkle: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x141414,
                metalness: 0.1,
                roughness: 0.62,
            }),
            { frequency: 380, slope: 0.45, roughness: 0.3 },
        ),
        hose: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x131314,
                metalness: 0,
                roughness: 0.74,
            }),
            { frequency: 1500, slope: 0.08 },
        ),
        belt: new THREE.MeshStandardMaterial({
            color: 0x101010,
            metalness: 0,
            roughness: 0.72,
        }),
        wire: new THREE.MeshStandardMaterial({
            color: 0x0d0d0e,
            metalness: 0,
            roughness: 0.6,
        }),
        translucent: new THREE.MeshPhysicalMaterial({
            color: 0xe9e5da,
            metalness: 0,
            roughness: 0.45,
            transmission: 0.55,
            thickness: 0.01,
        }),
        yellow: new THREE.MeshStandardMaterial({
            color: 0xe3a412,
            roughness: 0.45,
        }),
        orange: new THREE.MeshStandardMaterial({
            color: 0xd9601a,
            roughness: 0.45,
        }),
        red: new THREE.MeshStandardMaterial({
            color: 0xa3141b,
            roughness: 0.45,
        }),
        blue: new THREE.MeshStandardMaterial({
            color: 0x1d4f9a,
            roughness: 0.4,
        }),
        seat: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x1c1d1f,
                metalness: 0,
                roughness: 0.9,
            }),
            { frequency: 900, slope: 0.12 },
        ),
        dash: withDetail(
            new THREE.MeshStandardMaterial({
                color: 0x1e1f21,
                metalness: 0,
                roughness: 0.7,
            }),
            { frequency: 1200, slope: 0.1 },
        ),
        panel: new THREE.MeshPhysicalMaterial({
            color: 0xeeeeea,
            metalness: 0,
            roughness: 0.34,
            clearcoat: 0.5,
            clearcoatRoughness: 0.14,
        }),
        headliner: new THREE.MeshStandardMaterial({
            color: 0x6f7174,
            metalness: 0,
            roughness: 1,
        }),
        carpet: new THREE.MeshStandardMaterial({
            color: 0x121314,
            metalness: 0,
            roughness: 1,
        }),
        cabin: new THREE.MeshStandardMaterial({
            color: 0x232426,
            metalness: 0,
            roughness: 0.8,
            side: THREE.BackSide,
        }),
    };
}

/**
 * The materials that make up the outside of a body, which fade away when
 * the engine bay is opened up.
 */
export function shellMaterials(m: Materials): THREE.Material[] {
    return [m.paint, m.paintDark, m.enamel, m.gloss, m.plastic];
}

/**
 * The x-ray look a body takes on while the engine is being looked at: a
 * faint body with bright edges, so the shape is still there to get your
 * bearings by without hiding anything.
 */
export function ghostMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
            colour: { value: new THREE.Color(0x5b6b7d) },
            strength: { value: 0 },
        },
        vertexShader: /* glsl */ `
            #include <common>
            varying vec3 vGhostNormal;
            varying vec3 vGhostView;
            void main() {
                #include <beginnormal_vertex>
                #include <defaultnormal_vertex>
                #include <begin_vertex>
                #include <project_vertex>
                vGhostNormal = normalize(transformedNormal);
                vGhostView = -mvPosition.xyz;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 colour;
            uniform float strength;
            varying vec3 vGhostNormal;
            varying vec3 vGhostView;
            void main() {
                float facing = abs(dot(normalize(vGhostNormal), normalize(vGhostView)));
                float rim = pow(1.0 - facing, 2.2);
                gl_FragColor = vec4(colour, (0.035 + rim * 0.5) * strength);
            }
        `,
    });
}
