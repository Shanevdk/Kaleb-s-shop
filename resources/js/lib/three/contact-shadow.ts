import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

export type ContactShadowLayer = {
    /** How far above the floor something still darkens it, in metres. */
    reach: number;
    /** Blur passes, each roughly a nine-texel gaussian. */
    blur: number;
    /** Peak darkness from 0 to 1. */
    darkness: number;
    /** Higher values keep the shadow tight to whatever touches the floor. */
    falloff: number;
};

export type ContactShadow = {
    group: THREE.Group;
    setStrength(strength: number): void;
    dispose(): void;
};

/**
 * Bake the soft shadow a machine throws on a studio floor.
 *
 * The machine is rendered from underneath with an orthographic camera,
 * each pixel darkened by how close the nearest surface above it is to the
 * floor, then blurred. Several layers are stacked: a tight one that pins
 * the tyres to the ground and wider ones for the pool of shade under the
 * body. The machine never moves, so this is done once rather than every
 * frame.
 */
export function bakeContactShadow(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    subject: THREE.Object3D,
    bounds: THREE.Box3,
    layers: ContactShadowLayer[],
): ContactShadow {
    const size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const margin = Math.max(0.6, Math.max(size.x, size.z) * 0.22);
    const width = size.x + margin * 2;
    const depth = size.z + margin * 2;
    const resolution = 512;
    const pixelsX = resolution;
    const pixelsZ = Math.max(64, Math.round((resolution * depth) / width));

    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    const targets: THREE.WebGLRenderTarget[] = [];

    const heightMaterial = new THREE.ShaderMaterial({
        uniforms: {
            reach: { value: 1 },
            falloff: { value: 1 },
        },
        vertexShader: /* glsl */ `
            #include <common>
            varying float vHeight;
            void main() {
                #include <begin_vertex>
                vec4 world = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    world = instanceMatrix * world;
                #endif
                world = modelMatrix * world;
                vHeight = world.y;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float reach;
            uniform float falloff;
            varying float vHeight;
            void main() {
                float h = clamp(vHeight / reach, 0.0, 1.0);
                gl_FragColor = vec4(0.0, 0.0, 0.0, pow(1.0 - h, falloff));
            }
        `,
        side: THREE.DoubleSide,
    });

    const horizontal = new THREE.ShaderMaterial({
        ...HorizontalBlurShader,
        uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms),
    });
    const vertical = new THREE.ShaderMaterial({
        ...VerticalBlurShader,
        uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms),
    });
    const quad = new FullScreenQuad();

    // Looking straight up from just under the floor, with +Z at the top of
    // the image.
    const camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        depth / 2,
        -depth / 2,
        0,
        1,
    );
    camera.position.set(centre.x, -0.01, centre.z);
    camera.rotation.set(Math.PI / 2, 0, 0);
    camera.updateMatrixWorld();

    const previousTarget = renderer.getRenderTarget();
    const previousClear = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;
    const previousOverride = scene.overrideMaterial;
    const hidden: THREE.Object3D[] = [];

    for (const child of scene.children) {
        if (child !== subject && child.visible) {
            child.visible = false;
            hidden.push(child);
        }
    }

    scene.background = null;
    scene.overrideMaterial = heightMaterial;
    renderer.setClearColor(0x000000, 0);

    for (const layer of layers) {
        const make = () =>
            new THREE.WebGLRenderTarget(pixelsX, pixelsZ, {
                depthBuffer: true,
                generateMipmaps: false,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            });
        const a = make();
        const b = make();

        camera.far = layer.reach + 0.02;
        camera.updateProjectionMatrix();
        heightMaterial.uniforms.reach.value = layer.reach;
        heightMaterial.uniforms.falloff.value = layer.falloff;

        renderer.setRenderTarget(a);
        renderer.clear();
        renderer.render(scene, camera);

        for (let pass = 0; pass < layer.blur; pass++) {
            // Later passes spread wider, which keeps the edge soft without
            // needing dozens of passes.
            const spread = 1 + pass * 0.35;
            horizontal.uniforms.tDiffuse.value = a.texture;
            horizontal.uniforms.h.value = spread / pixelsX;
            quad.material = horizontal;
            renderer.setRenderTarget(b);
            renderer.clear();
            quad.render(renderer);

            vertical.uniforms.tDiffuse.value = b.texture;
            vertical.uniforms.v.value = spread / pixelsZ;
            quad.material = vertical;
            renderer.setRenderTarget(a);
            renderer.clear();
            quad.render(renderer);
        }

        b.dispose();
        targets.push(a);

        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: a.texture,
            transparent: true,
            depthWrite: false,
            opacity: layer.darkness,
        });
        material.userData.baseOpacity = layer.darkness;
        materials.push(material);

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(width, depth),
            material,
        );
        plane.rotation.x = -Math.PI / 2;
        plane.scale.y = -1;
        plane.position.set(centre.x, 0.001 + targets.length * 0.0005, centre.z);
        plane.renderOrder = -10 + targets.length;
        group.add(plane);
    }

    scene.overrideMaterial = previousOverride;
    scene.background = previousBackground;
    for (const object of hidden) {
        object.visible = true;
    }
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClear, previousAlpha);

    heightMaterial.dispose();
    horizontal.dispose();
    vertical.dispose();
    quad.dispose();

    return {
        group,
        setStrength(strength) {
            for (const material of materials) {
                material.opacity =
                    (material.userData.baseOpacity as number) * strength;
            }
        },
        dispose() {
            for (const target of targets) {
                target.dispose();
            }
            for (const material of materials) {
                material.dispose();
            }
            group.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                }
            });
        },
    };
}
