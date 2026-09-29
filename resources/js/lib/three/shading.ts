import * as THREE from 'three';

/**
 * A change to a built-in material's shader. Several can stack on one
 * material (surface detail, paint flake, photo wrap), and a clone of the
 * material gets them all again.
 */
export type ShaderPatch = {
    key: string;
    apply(shader: THREE.WebGLProgramParametersWithUniforms): void;
};

const patchesOf = new WeakMap<THREE.Material, ShaderPatch[]>();

export function addPatch(material: THREE.Material, patch: ShaderPatch): void {
    const patches = [
        ...(patchesOf.get(material) ?? []).filter((p) => p.key !== patch.key),
        patch,
    ];
    patchesOf.set(material, patches);
    material.onBeforeCompile = (shader) => {
        for (const p of patches) {
            p.apply(shader);
        }
    };
    material.customProgramCacheKey = () => patches.map((p) => p.key).join('|');
    material.needsUpdate = true;
}

/**
 * Clone a material together with its shader patches, which a plain
 * `clone()` would drop.
 */
export function clonePatched<T extends THREE.Material>(material: T): T {
    const copy = material.clone() as T;

    for (const patch of patchesOf.get(material) ?? []) {
        addPatch(copy, patch);
    }

    return copy;
}

/**
 * Where each patch puts its own declarations in the fragment shader: after
 * the shared helpers, in the order the patches are applied.
 */
const ANCHOR = '// surface patches';

function declare(
    shader: THREE.WebGLProgramParametersWithUniforms,
    text: string,
): void {
    shader.fragmentShader = shader.fragmentShader.replace(
        ANCHOR,
        `${text}\n${ANCHOR}`,
    );
}

/**
 * The world position of every fragment, instancing included, for
 * procedural effects that need no UVs.
 */
function worldPosition(shader: THREE.WebGLProgramParametersWithUniforms): void {
    if (shader.fragmentShader.includes(ANCHOR)) {
        return;
    }

    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vSurfaceWorld;',
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
                vec4 surfaceWorld = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    surfaceWorld = instanceMatrix * surfaceWorld;
                #endif
                vSurfaceWorld = (modelMatrix * surfaceWorld).xyz;
            }`,
        );
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSurfaceWorld;
        float surfaceHash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float surfaceNoise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(mix(surfaceHash(i), surfaceHash(i + vec3(1, 0, 0)), f.x),
                    mix(surfaceHash(i + vec3(0, 1, 0)), surfaceHash(i + vec3(1, 1, 0)), f.x), f.y),
                mix(mix(surfaceHash(i + vec3(0, 0, 1)), surfaceHash(i + vec3(1, 0, 1)), f.x),
                    mix(surfaceHash(i + vec3(0, 1, 1)), surfaceHash(i + vec3(1, 1, 1)), f.x), f.y),
                f.z);
        }
        vec3 surfacePerturb(vec3 position, vec3 normal, vec2 dHdxy, float faceDirection) {
            vec3 sigmaX = dFdx(position);
            vec3 sigmaY = dFdy(position);
            vec3 r1 = cross(sigmaY, normal);
            vec3 r2 = cross(normal, sigmaX);
            float det = dot(sigmaX, r1) * faceDirection;
            vec3 gradient = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
            return normalize(abs(det) * normal - gradient);
        }
        ${ANCHOR}`,
    );
}

export type Detail = {
    /** Bumps per metre. */
    frequency: number;
    /** How steep the bumps get; 0.05 is a fine grain, 0.3 is rough sand. */
    slope: number;
    /** How much the roughness wanders, 0 to 1. */
    roughness?: number;
    /** Stretch along world axes, for brushed or ribbed surfaces. */
    stretch?: [number, number, number];
};

/**
 * Micro-surface detail from 3D noise in world space: sand-cast grain on a
 * block, the texture moulded into black plastic, the tooth of rubber. It
 * fades out as it shrinks below a pixel, so it never shimmers.
 */
export function withDetail<T extends THREE.Material>(
    material: T,
    detail: Detail,
): T {
    const stretch = detail.stretch ?? [1, 1, 1];
    const uniforms = {
        detailScale: {
            value: new THREE.Vector3(
                detail.frequency * stretch[0],
                detail.frequency * stretch[1],
                detail.frequency * stretch[2],
            ),
        },
        detailAmplitude: { value: detail.slope / detail.frequency },
        detailRoughness: { value: detail.roughness ?? 0 },
    };

    addPatch(material, {
        key: `detail:${detail.frequency}:${detail.slope}:${detail.roughness ?? 0}:${stretch.join(',')}`,
        apply(shader) {
            worldPosition(shader);
            Object.assign(shader.uniforms, uniforms);
            declare(
                shader,
                `uniform vec3 detailScale;
                uniform float detailAmplitude;
                uniform float detailRoughness;
                float detailField(vec3 p) {
                    return surfaceNoise(p) * 0.62
                        + surfaceNoise(p * 2.17 + 7.1) * 0.27
                        + surfaceNoise(p * 4.41 + 3.3) * 0.11;
                }`,
            );
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <roughnessmap_fragment>',
                    `#include <roughnessmap_fragment>
                    roughnessFactor = clamp(
                        roughnessFactor * (1.0 + (surfaceNoise(vSurfaceWorld * detailScale * 0.31 + 5.0) - 0.5) * detailRoughness),
                        0.02, 1.0);`,
                )
                .replace(
                    '#include <normal_fragment_maps>',
                    `#include <normal_fragment_maps>
                    {
                        vec3 detailPoint = vSurfaceWorld * detailScale;
                        float footprint = length(fwidth(detailPoint));
                        float fade = 1.0 - smoothstep(0.3, 1.1, footprint);
                        if (fade > 0.0) {
                            float height = detailField(detailPoint) * detailAmplitude * fade;
                            normal = surfacePerturb(-vViewPosition, normal, vec2(dFdx(height), dFdy(height)), faceDirection);
                        }
                    }`,
                );
        },
    });

    return material;
}

/**
 * Metallic flake under a clear coat: each flake is a tiny tilted mirror in
 * the base layer, so the paint sparkles up close while the clear coat on
 * top stays glass smooth.
 */
export function withFlake<T extends THREE.Material>(
    material: T,
    strength: number,
    size = 0.0006,
): T {
    const uniforms = {
        flakeFrequency: { value: 1 / size },
        flakeStrength: { value: strength },
    };

    addPatch(material, {
        key: `flake:${strength}:${size}`,
        apply(shader) {
            worldPosition(shader);
            Object.assign(shader.uniforms, uniforms);
            declare(
                shader,
                `uniform float flakeFrequency;
                uniform float flakeStrength;`,
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_maps>',
                `#include <normal_fragment_maps>
                    {
                        vec3 flakePoint = vSurfaceWorld * flakeFrequency;
                        vec3 cell = floor(flakePoint);
                        vec3 tilt = vec3(
                            surfaceHash(cell),
                            surfaceHash(cell + 17.31),
                            surfaceHash(cell + 41.7)
                        ) * 2.0 - 1.0;
                        float footprint = length(fwidth(flakePoint));
                        float fade = 1.0 - smoothstep(0.35, 1.4, footprint);
                        normal = normalize(normal + tilt * flakeStrength * fade);
                    }`,
            );
        },
    });

    return material;
}

/**
 * The crystal pattern of hot-dip galvanising: the zinc freezes in spangles
 * a centimetre or so across, each at its own angle, so some catch the
 * light while their neighbours stay dull.
 */
export function withSpangle<T extends THREE.Material>(
    material: T,
    size = 0.012,
): T {
    const uniforms = {
        spangleFrequency: { value: 1 / size },
    };

    addPatch(material, {
        key: `spangle:${size}`,
        apply(shader) {
            worldPosition(shader);
            Object.assign(shader.uniforms, uniforms);
            declare(
                shader,
                `uniform float spangleFrequency;
                vec3 spangleCell(vec3 p) {
                    p += vec3(
                        surfaceNoise(p * 0.8),
                        surfaceNoise(p * 0.8 + 11.3),
                        surfaceNoise(p * 0.8 + 23.7)
                    ) * 1.4;
                    return floor(p);
                }
                float spangleFade() {
                    return 1.0 - smoothstep(0.35, 1.2, length(fwidth(vSurfaceWorld * spangleFrequency)));
                }`,
            );
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <roughnessmap_fragment>',
                    `#include <roughnessmap_fragment>
                    {
                        float spangle = surfaceHash(spangleCell(vSurfaceWorld * spangleFrequency));
                        roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.55 + spangle * 0.9, spangleFade()), 0.04, 1.0);
                    }`,
                )
                .replace(
                    '#include <normal_fragment_maps>',
                    `#include <normal_fragment_maps>
                    {
                        vec3 cell = spangleCell(vSurfaceWorld * spangleFrequency);
                        vec3 tilt = vec3(
                            surfaceHash(cell + 3.1),
                            surfaceHash(cell + 19.7),
                            surfaceHash(cell + 37.3)
                        ) * 2.0 - 1.0;
                        normal = normalize(normal + tilt * 0.06 * spangleFade());
                    }`,
                );
        },
    });

    return material;
}
