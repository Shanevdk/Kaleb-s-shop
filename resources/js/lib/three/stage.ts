import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import {
    bakeContactShadow,
    type ContactShadow,
} from '@/lib/three/contact-shadow';
import { StudioEnvironment } from '@/lib/three/studio';

export type Appearance = 'light' | 'dark';

export type Quality = 'high' | 'low';

/**
 * Things on this layer are drawn but throw no shadow and take no ambient
 * occlusion: glass, lamp lenses, the floor and the x-ray ghost of the body.
 * Letting them into the occlusion pass would darken whatever is behind
 * them as if they were solid.
 */
export const SEE_THROUGH_LAYER = 1;

export type StageOptions = {
    appearance: Appearance;
    quality?: Quality;
};

/**
 * Pick a quality tier before anything is drawn. Phones and tablets get the
 * plain renderer; everything else gets ambient occlusion and multisampling
 * until it proves too slow.
 */
export function defaultQuality(): Quality {
    if (typeof window === 'undefined') {
        return 'high';
    }

    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory =
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

    return coarse || cores < 4 || memory < 4 ? 'low' : 'high';
}

/**
 * The studio a machine is shown in: renderer, camera and orbit controls,
 * reflections, a soft overhead key that throws a shadow, a floor that only
 * shows shadows, and ambient occlusion on capable hardware.
 *
 * The canvas is transparent, so the page shows behind the machine and the
 * floor is only ever the darkening under it.
 */
export class Stage {
    readonly renderer: THREE.WebGLRenderer;
    readonly scene = new THREE.Scene();
    readonly camera: THREE.PerspectiveCamera;
    readonly controls: OrbitControls;
    readonly key: THREE.DirectionalLight;

    quality: Quality;

    private readonly element: HTMLElement;
    private readonly environment: THREE.WebGLRenderTarget;
    private readonly shadowFloor: THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.ShadowMaterial
    >;
    private composer: EffectComposer | null = null;
    private occlusion: GTAOPass | null = null;
    private readonly occlusionCamera = new THREE.PerspectiveCamera();
    private contact: ContactShadow | null = null;
    private readonly resize: ResizeObserver;
    private readonly visibility: IntersectionObserver;
    private onScreen = true;
    private frame = 0;
    private running = false;
    private appearance: Appearance;
    private slowFrames = 0;
    private sampledFrames = 0;
    private lastFrame = 0;
    private update: ((now: number, delta: number) => void) | null = null;

    constructor(element: HTMLElement, options: StageOptions) {
        this.element = element;
        this.quality = options.quality ?? defaultQuality();
        this.appearance = options.appearance;

        const width = element.clientWidth || 640;
        const height = element.clientHeight || 400;

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                this.quality === 'high' ? 2 : 1.5,
            ),
        );
        this.renderer.setSize(width, height, false);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NeutralToneMapping;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;

        const canvas = this.renderer.domElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        element.appendChild(canvas);

        // Reflections come from the studio; nothing else lights the scene
        // softly.
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const studio = new StudioEnvironment();
        this.environment = pmrem.fromScene(studio, 0.012, 0.1, 100, {
            size: this.quality === 'high' ? 512 : 256,
        });
        studio.dispose();
        pmrem.dispose();
        this.scene.environment = this.environment.texture;

        this.camera = new THREE.PerspectiveCamera(
            30,
            width / height,
            0.05,
            200,
        );
        this.camera.layers.enable(SEE_THROUGH_LAYER);

        // A soft key from above and slightly forward, matching the big
        // overhead diffuser in the reflections.
        this.key = new THREE.DirectionalLight(0xfffaf2, 1.6);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(
            this.quality === 'high' ? 2048 : 1024,
            this.quality === 'high' ? 2048 : 1024,
        );
        this.key.shadow.radius = 8;
        this.key.shadow.blurSamples = 16;
        this.key.shadow.bias = -0.0004;
        this.key.shadow.normalBias = 0.015;
        this.scene.add(this.key, this.key.target);

        this.shadowFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.ShadowMaterial({ opacity: 0.2, depthWrite: false }),
        );
        this.shadowFloor.rotation.x = -Math.PI / 2;
        this.shadowFloor.position.y = 0.0005;
        this.shadowFloor.receiveShadow = true;
        this.shadowFloor.renderOrder = -1;
        this.shadowFloor.layers.set(SEE_THROUGH_LAYER);
        this.scene.add(this.shadowFloor);

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.rotateSpeed = 0.7;
        this.controls.autoRotateSpeed = 0.5;

        if (this.quality === 'high') {
            this.buildPostProcessing(width, height);
        }

        this.setAppearance(options.appearance);

        this.resize = new ResizeObserver(() => this.fit());
        this.resize.observe(element);

        this.visibility = new IntersectionObserver((entries) => {
            this.onScreen = entries.some((entry) => entry.isIntersecting);

            if (this.onScreen) {
                this.loop();
            }
        });
        this.visibility.observe(element);
    }

    /**
     * Frame the shadows and the occlusion around the thing on show.
     */
    setSubject(subject: THREE.Object3D): THREE.Box3 {
        subject.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(subject);
        const size = bounds.getSize(new THREE.Vector3());
        const centre = bounds.getCenter(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z);

        this.key.position.set(
            centre.x + span * 0.35,
            centre.y + span * 1.6,
            centre.z + span * 0.55,
        );
        this.key.target.position.copy(centre);
        this.key.target.updateMatrixWorld();

        const reach = span * 0.9;
        const camera = this.key.shadow.camera;
        camera.left = -reach;
        camera.right = reach;
        camera.top = reach;
        camera.bottom = -reach;
        camera.near = span * 0.2;
        camera.far = span * 4;
        camera.updateProjectionMatrix();

        this.shadowFloor.scale.set(span * 4, span * 4, 1);
        this.shadowFloor.position.x = centre.x;
        this.shadowFloor.position.z = centre.z;

        this.camera.near = Math.max(0.02, span * 0.01);
        this.camera.far = span * 30;
        this.camera.updateProjectionMatrix();

        this.contact?.dispose();
        this.contact?.group.removeFromParent();
        this.contact = bakeContactShadow(
            this.renderer,
            this.scene,
            subject,
            bounds,
            [
                { reach: span * 0.05, blur: 2, darkness: 0.55, falloff: 2.2 },
                { reach: span * 0.16, blur: 5, darkness: 0.45, falloff: 1.6 },
                { reach: span * 0.4, blur: 9, darkness: 0.25, falloff: 1.2 },
            ],
        );
        this.contact.group.traverse((object) =>
            object.layers.set(SEE_THROUGH_LAYER),
        );
        this.scene.add(this.contact.group);
        this.applyAppearance();

        if (this.occlusion) {
            this.occlusion.updateGtaoMaterial({
                radius: Math.max(0.12, span * 0.045),
                distanceExponent: 1.4,
                thickness: Math.max(0.3, span * 0.12),
                scale: 1,
                samples: 16,
            });
        }

        return bounds;
    }

    setAppearance(appearance: Appearance): void {
        this.appearance = appearance;
        this.applyAppearance();
    }

    /**
     * Run a function every frame while the stage is on screen.
     */
    start(update: (now: number, delta: number) => void): void {
        this.update = update;
        this.running = true;
        this.loop();
    }

    render(): void {
        if (this.composer && this.occlusion) {
            this.occlusionCamera.copy(this.camera);
            this.occlusionCamera.layers.set(0);
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    dispose(): void {
        this.running = false;
        cancelAnimationFrame(this.frame);
        this.resize.disconnect();
        this.visibility.disconnect();
        this.controls.dispose();
        this.contact?.dispose();
        this.shadowFloor.geometry.dispose();
        this.shadowFloor.material.dispose();
        this.occlusion?.dispose();
        this.composer?.dispose();
        this.environment.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private loop(): void {
        if (!this.running || !this.onScreen) {
            return;
        }

        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame((now) => {
            const delta = this.lastFrame ? now - this.lastFrame : 16;
            this.lastFrame = now;
            this.update?.(now, delta);
            this.controls.update(delta / 1000);
            this.render();
            this.watchSpeed(delta);
            this.loop();
        });
    }

    /**
     * Drop to the plain renderer when a machine cannot keep up, rather than
     * stuttering through every spin.
     */
    private watchSpeed(delta: number): void {
        if (this.quality !== 'high' || document.hidden) {
            return;
        }

        // Ignore the first frames while shaders compile.
        this.sampledFrames += 1;

        if (this.sampledFrames < 30 || delta > 250) {
            return;
        }

        this.slowFrames =
            delta > 40 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);

        if (this.slowFrames > 45) {
            this.quality = 'low';
            this.composer?.dispose();
            this.occlusion?.dispose();
            this.composer = null;
            this.occlusion = null;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            this.fit();
        }
    }

    private buildPostProcessing(width: number, height: number): void {
        const pixelRatio = this.renderer.getPixelRatio();
        const target = new THREE.WebGLRenderTarget(
            width * pixelRatio,
            height * pixelRatio,
            { type: THREE.HalfFloatType, samples: 4 },
        );

        this.composer = new EffectComposer(this.renderer, target);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Occlusion is worked out at half resolution from a copy of the
        // camera that cannot see glass or the ghost.
        this.occlusionCamera.copy(this.camera);
        this.occlusionCamera.layers.set(0);
        this.occlusion = new HalfResolutionOcclusion(
            this.scene,
            this.occlusionCamera,
            Math.round((width * pixelRatio) / 2),
            Math.round((height * pixelRatio) / 2),
        );
        this.occlusion.blendIntensity = 0.85;
        this.occlusion.updatePdMaterial({
            lumaPhi: 10,
            depthPhi: 2,
            normalPhi: 3,
            radius: 6,
            rings: 2,
            samples: 16,
        });
        this.composer.addPass(this.occlusion);
        this.composer.addPass(new OutputPass());
    }

    private applyAppearance(): void {
        const dark = this.appearance === 'dark';
        this.renderer.toneMappingExposure = dark ? 0.95 : 1.05;
        this.shadowFloor.material.opacity = dark ? 0.32 : 0.16;
        this.contact?.setStrength(dark ? 1.25 : 1);
    }

    private fit(): void {
        const { clientWidth, clientHeight } = this.element;

        if (clientWidth === 0 || clientHeight === 0) {
            return;
        }

        this.camera.aspect = clientWidth / clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight, false);
        this.composer?.setPixelRatio(this.renderer.getPixelRatio());
        this.composer?.setSize(clientWidth, clientHeight);
    }
}

/**
 * GTAO worked out at half the resolution of the picture it darkens. At a
 * car's scale nothing is lost, and it costs a quarter as much.
 */
class HalfResolutionOcclusion extends GTAOPass {
    setSize(width: number, height: number): void {
        super.setSize(Math.round(width / 2), Math.round(height / 2));
    }
}
