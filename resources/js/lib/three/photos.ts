import * as THREE from 'three';

export type ProjectionSide = 'front' | 'rear' | 'left' | 'right' | 'top';

export type PhotoProjection = {
    setBounds(box: THREE.Box3): void;
    setPhoto(side: ProjectionSide, url: string | null): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
};

const SIDES: ProjectionSide[] = ['front', 'rear', 'left', 'right', 'top'];

/**
 * How much of the photo's width the machine is assumed to fill. People
 * frame a vehicle a little inside the edges.
 */
const FILL = 0.88;

/**
 * Wrap walk-around photos onto the model.
 *
 * Every face of the body is projected from whichever of the five box sides
 * it mostly faces, using the machine's bounding box to line the photo up
 * with the shape. It is a box projection, not photogrammetry, so straight-on
 * shots framed the same way give the best result.
 */
export function installPhotoProjection(
    materials: THREE.Material[],
): PhotoProjection {
    const blank = new THREE.DataTexture(
        new Uint8Array([128, 128, 128, 255]),
        1,
        1,
    );
    blank.needsUpdate = true;

    const uniforms = {
        photoEnabled: { value: 0 },
        photoMin: { value: new THREE.Vector3(-1, 0, -1) },
        photoMax: { value: new THREE.Vector3(1, 1, 1) },
        photoFront: { value: blank as THREE.Texture },
        photoRear: { value: blank as THREE.Texture },
        photoLeft: { value: blank as THREE.Texture },
        photoRight: { value: blank as THREE.Texture },
        photoTop: { value: blank as THREE.Texture },
        hasFront: { value: 0 },
        hasRear: { value: 0 },
        hasLeft: { value: 0 },
        hasRight: { value: 0 },
        hasTop: { value: 0 },
        fitFront: { value: new THREE.Vector2(FILL, FILL) },
        fitRear: { value: new THREE.Vector2(FILL, FILL) },
        fitLeft: { value: new THREE.Vector2(FILL, FILL) },
        fitRight: { value: new THREE.Vector2(FILL, FILL) },
        fitTop: { value: new THREE.Vector2(FILL, FILL) },
    };

    const textures: Partial<Record<ProjectionSide, THREE.Texture>> = {};
    const loading: Partial<Record<ProjectionSide, string>> = {};
    const loader = new THREE.TextureLoader();

    for (const material of materials) {
        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    '#include <common>\nvarying vec3 vPhotoPos;\nvarying vec3 vPhotoNormal;',
                )
                .replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\nvPhotoPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPhotoNormal = normalize(mat3(modelMatrix) * objectNormal);',
                );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    `#include <common>
varying vec3 vPhotoPos;
varying vec3 vPhotoNormal;
uniform float photoEnabled;
uniform vec3 photoMin;
uniform vec3 photoMax;
uniform sampler2D photoFront;
uniform sampler2D photoRear;
uniform sampler2D photoLeft;
uniform sampler2D photoRight;
uniform sampler2D photoTop;
uniform float hasFront;
uniform float hasRear;
uniform float hasLeft;
uniform float hasRight;
uniform float hasTop;
uniform vec2 fitFront;
uniform vec2 fitRear;
uniform vec2 fitLeft;
uniform vec2 fitRight;
uniform vec2 fitTop;
vec2 photoFit(vec2 uv, vec2 fit) {
    return 0.5 + (uv - 0.5) * fit;
}`,
                )
                .replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
if (photoEnabled > 0.5) {
    vec3 pn = normalize(vPhotoNormal);
    vec3 pa = abs(pn);
    vec3 pp = clamp((vPhotoPos - photoMin) / max(photoMax - photoMin, vec3(0.001)), 0.0, 1.0);
    vec4 photo = vec4(0.0);
    float has = 0.0;
    if (pa.y > pa.x && pa.y > pa.z && pn.y > 0.0) {
        photo = texture2D(photoTop, photoFit(vec2(pp.z, pp.x), fitTop));
        has = hasTop;
    } else if (pa.x >= pa.z) {
        if (pn.x > 0.0) {
            photo = texture2D(photoFront, photoFit(vec2(1.0 - pp.z, pp.y), fitFront));
            has = hasFront;
        } else {
            photo = texture2D(photoRear, photoFit(vec2(pp.z, pp.y), fitRear));
            has = hasRear;
        }
    } else {
        if (pn.z > 0.0) {
            photo = texture2D(photoRight, photoFit(vec2(pp.x, pp.y), fitRight));
            has = hasRight;
        } else {
            photo = texture2D(photoLeft, photoFit(vec2(1.0 - pp.x, pp.y), fitLeft));
            has = hasLeft;
        }
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, photo.rgb, has);
}`,
                );
        };
        material.customProgramCacheKey = () => 'photo-projection';
        material.needsUpdate = true;
    }

    const uniformFor = (side: ProjectionSide) => {
        const key = side.charAt(0).toUpperCase() + side.slice(1);

        return {
            texture: uniforms[`photo${key}` as 'photoFront'],
            has: uniforms[`has${key}` as 'hasFront'],
            fit: uniforms[`fit${key}` as 'fitFront'],
        };
    };

    /**
     * Line the photo up with the face: the machine fills most of the width,
     * and its height in the frame follows from the photo's and the face's
     * proportions.
     */
    const refit = () => {
        const size = new THREE.Vector3().subVectors(
            uniforms.photoMax.value,
            uniforms.photoMin.value,
        );
        const faces: Record<ProjectionSide, [number, number]> = {
            front: [size.z, size.y],
            rear: [size.z, size.y],
            left: [size.x, size.y],
            right: [size.x, size.y],
            top: [size.z, size.x],
        };

        for (const side of SIDES) {
            const texture = textures[side];
            const image = texture?.image as
                | { width?: number; height?: number }
                | undefined;

            if (!texture || !image?.width || !image.height) {
                continue;
            }

            const [faceWidth, faceHeight] = faces[side];
            let fitU = FILL;
            let fitV =
                (fitU * (image.width / image.height)) /
                (faceWidth / faceHeight);

            if (fitV > 0.96) {
                fitU *= 0.96 / fitV;
                fitV = 0.96;
            }

            uniformFor(side).fit.value.set(fitU, fitV);
        }
    };

    return {
        setBounds(box) {
            uniforms.photoMin.value.copy(box.min);
            uniforms.photoMax.value.copy(box.max);
            refit();
        },

        setPhoto(side, url) {
            const target = uniformFor(side);

            if (!url) {
                textures[side]?.dispose();
                delete textures[side];
                delete loading[side];
                target.texture.value = blank;
                target.has.value = 0;

                return;
            }

            if (loading[side] === url) {
                return;
            }

            loading[side] = url;
            loader.load(url, (texture) => {
                if (loading[side] !== url) {
                    texture.dispose();

                    return;
                }

                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 8;
                textures[side]?.dispose();
                textures[side] = texture;
                target.texture.value = texture;
                target.has.value = 1;
                refit();
            });
        },

        setEnabled(enabled) {
            uniforms.photoEnabled.value = enabled ? 1 : 0;
        },

        dispose() {
            for (const side of SIDES) {
                textures[side]?.dispose();
                delete textures[side];
                delete loading[side];
            }
            blank.dispose();
        },
    };
}
