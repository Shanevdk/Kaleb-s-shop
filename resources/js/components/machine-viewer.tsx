import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { EnginePartKey } from '@/lib/engine-parts';
import { buildBody } from '@/lib/three/bodies';
import { buildEngine, type EngineInput } from '@/lib/three/engine';
import { bodyMaterials, makeMaterials } from '@/lib/three/materials';
import {
    installPhotoProjection,
    type PhotoProjection,
} from '@/lib/three/photos';
import type { EngineSpecs, MachineKind, VehiclePhotos } from '@/types';

export type ViewerView = 'machine' | 'engine';

export type MachineViewerProps = {
    kind: MachineKind;
    engine: Partial<EngineSpecs>;
    doors?: number | null;
    photos?: VehiclePhotos;
    wrapPhotos?: boolean;
    view: ViewerView;
    selectedPart: EnginePartKey | null;
    appearance: 'light' | 'dark';
    onViewChange: (view: ViewerView) => void;
    onHoverPart: (part: EnginePartKey | 'engine' | null) => void;
    onSelectPart: (part: EnginePartKey | null) => void;
    onPartsReady: (parts: EnginePartKey[]) => void;
};

type Frame = { position: THREE.Vector3; target: THREE.Vector3 };

type Scene = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    hotspot: THREE.Group;
    engine: THREE.Group;
    engineExposed: boolean;
    projection: PhotoProjection;
    ground: THREE.Mesh<THREE.CircleGeometry, THREE.ShadowMaterial>;
    grid: THREE.GridHelper;
    environment: THREE.Texture;
    bodyMaterials: THREE.Material[];
    parts: Map<EnginePartKey, THREE.Mesh[]>;
    hotspotMeshes: THREE.Mesh[];
    machineFrame: Frame;
    engineFrame: Frame;
    tween: { from: Frame; to: Frame; start: number; duration: number } | null;
    fade: { from: number; to: number; start: number } | null;
    hovered: EnginePartKey | 'engine' | null;
    frame: number;
};

const HOVER = new THREE.Color(0x6ea8ff);
const SELECTED = new THREE.Color(0xf59e0b);
const NONE = new THREE.Color(0x000000);

/**
 * A procedural 3D model of the machine with a clickable engine.
 *
 * The body is built from the kind of machine; the engine from whatever the
 * VIN decoder or the mechanic said about it. It is lit by a studio
 * environment with soft shadows and rendered in monochrome materials, so
 * what you see is shape, not paint. Clicking the engine bay fades the body
 * away and flies the camera in, where each part can be picked out.
 */
export default function MachineViewer(props: MachineViewerProps) {
    const container = useRef<HTMLDivElement>(null);
    const state = useRef<Scene | null>(null);
    const latest = useRef(props);

    useEffect(() => {
        latest.current = props;
    });

    const engineKey = JSON.stringify({
        cylinders: props.engine.cylinders ?? null,
        displacement: props.engine.displacement_l ?? null,
        configuration: props.engine.configuration ?? null,
        fuel: props.engine.fuel ?? null,
        turbo: props.engine.turbo ?? null,
    } satisfies EngineInput);

    // Build the scene once per machine, and tear it down completely after.
    useEffect(() => {
        const element = container.current;

        if (!element) {
            return;
        }

        const scene = buildScene(
            element,
            props.kind,
            JSON.parse(engineKey) as EngineInput,
            props.doors ?? null,
        );
        state.current = scene;

        latest.current.onPartsReady([...scene.parts.keys()]);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let pressed: { x: number; y: number } | null = null;

        const pick = (event: PointerEvent): THREE.Intersection[] => {
            const bounds = element.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, scene.camera);

            const targets =
                latest.current.view === 'machine'
                    ? scene.hotspotMeshes
                    : [...scene.parts.values()].flat();

            return raycaster.intersectObjects(targets, false);
        };

        const partOf = (hit: THREE.Intersection | undefined) =>
            hit
                ? ((hit.object.userData.part as
                      | EnginePartKey
                      | 'engine'
                      | undefined) ?? null)
                : null;

        const onMove = (event: PointerEvent) => {
            const part = partOf(pick(event)[0]);

            if (part !== scene.hovered) {
                scene.hovered = part;
                element.style.cursor = part ? 'pointer' : '';
                latest.current.onHoverPart(part);
                paint(scene, latest.current.selectedPart);
            }
        };

        const onDown = (event: PointerEvent) => {
            pressed = { x: event.clientX, y: event.clientY };
        };

        const onUp = (event: PointerEvent) => {
            if (!pressed) {
                return;
            }

            const moved = Math.hypot(
                event.clientX - pressed.x,
                event.clientY - pressed.y,
            );
            pressed = null;

            if (moved > 6) {
                return;
            }

            const part = partOf(pick(event)[0]);

            if (latest.current.view === 'machine') {
                if (part === 'engine') {
                    latest.current.onViewChange('engine');
                }

                return;
            }

            latest.current.onSelectPart(part === 'engine' ? null : part);
        };

        const onLeave = () => {
            if (scene.hovered !== null) {
                scene.hovered = null;
                element.style.cursor = '';
                latest.current.onHoverPart(null);
                paint(scene, latest.current.selectedPart);
            }
        };

        element.addEventListener('pointermove', onMove);
        element.addEventListener('pointerdown', onDown);
        element.addEventListener('pointerup', onUp);
        element.addEventListener('pointerleave', onLeave);

        const resize = new ResizeObserver(() => {
            const { clientWidth, clientHeight } = element;

            if (clientWidth === 0 || clientHeight === 0) {
                return;
            }

            scene.camera.aspect = clientWidth / clientHeight;
            scene.camera.updateProjectionMatrix();
            scene.renderer.setSize(clientWidth, clientHeight, false);
        });
        resize.observe(element);

        const clock = new THREE.Clock();

        const animate = () => {
            scene.frame = requestAnimationFrame(animate);
            const now = performance.now();
            const elapsed = clock.getElapsedTime();

            if (scene.tween) {
                const t = easeInOut(
                    Math.min(
                        1,
                        (now - scene.tween.start) / scene.tween.duration,
                    ),
                );
                scene.camera.position.lerpVectors(
                    scene.tween.from.position,
                    scene.tween.to.position,
                    t,
                );
                scene.controls.target.lerpVectors(
                    scene.tween.from.target,
                    scene.tween.to.target,
                    t,
                );

                if (t >= 1) {
                    scene.tween = null;
                }
            }

            if (scene.fade) {
                const t = Math.min(1, (now - scene.fade.start) / 600);
                const opacity =
                    scene.fade.from + (scene.fade.to - scene.fade.from) * t;

                for (const material of scene.bodyMaterials) {
                    const base = (material.userData.baseOpacity as number) ?? 1;
                    material.opacity = base * opacity;
                    material.transparent = opacity < 1 || base < 1;
                    material.depthWrite = opacity >= 1;
                }

                if (t >= 1) {
                    scene.fade = null;

                    // Once the body is solid again, a covered engine goes
                    // back under its cover.
                    if (
                        latest.current.view === 'machine' &&
                        !scene.engineExposed
                    ) {
                        scene.engine.visible = false;
                    }
                }
            }

            const pulse = 1 + Math.sin(elapsed * 3) * 0.08;
            scene.hotspot.scale.setScalar(
                (scene.hotspot.userData.baseScale as number) * pulse,
            );
            scene.hotspot.rotation.y = elapsed * 0.8;

            scene.controls.update();
            scene.renderer.render(scene.scene, scene.camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(scene.frame);
            resize.disconnect();
            element.removeEventListener('pointermove', onMove);
            element.removeEventListener('pointerdown', onDown);
            element.removeEventListener('pointerup', onUp);
            element.removeEventListener('pointerleave', onLeave);
            scene.controls.dispose();
            scene.scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];
                    materials.forEach((material) => material.dispose());
                }
            });
            scene.projection.dispose();
            scene.environment.dispose();
            scene.renderer.dispose();
            scene.renderer.domElement.remove();
            state.current = null;
        };
        // The engine is compared by value through engineKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.kind, engineKey, props.doors]);

    // Fly between the whole machine and the engine bay.
    useEffect(() => {
        const scene = state.current;

        if (!scene) {
            return;
        }

        const to =
            props.view === 'engine' ? scene.engineFrame : scene.machineFrame;

        scene.tween = {
            from: {
                position: scene.camera.position.clone(),
                target: scene.controls.target.clone(),
            },
            to: { position: to.position.clone(), target: to.target.clone() },
            start: performance.now(),
            duration: 900,
        };
        scene.fade = {
            from: scene.bodyMaterials[0]
                ? scene.bodyMaterials[0].opacity /
                  ((scene.bodyMaterials[0].userData.baseOpacity as number) ?? 1)
                : 1,
            to: props.view === 'engine' ? 0.07 : 1,
            start: performance.now(),
        };
        if (props.view === 'engine' || scene.engineExposed) {
            scene.engine.visible = true;
        }
        scene.hotspot.visible =
            props.view === 'machine' && scene.parts.size > 0;
        scene.controls.autoRotate = props.view === 'machine';
        scene.hovered = null;
        paint(scene, props.selectedPart);
        // A rebuilt scene (new kind or engine) must land on the right frame too.
    }, [props.view, props.selectedPart, props.kind, engineKey, props.doors]);

    // Wrap the walk-around photos over the body when asked to.
    const photoKey = JSON.stringify({
        front: props.photos?.front ?? null,
        rear: props.photos?.rear ?? null,
        left: props.photos?.left ?? null,
        right: props.photos?.right ?? null,
        top: props.photos?.top ?? null,
    });

    useEffect(() => {
        const scene = state.current;

        if (!scene) {
            return;
        }

        const photos = JSON.parse(photoKey) as Record<
            'front' | 'rear' | 'left' | 'right' | 'top',
            string | null
        >;

        for (const side of ['front', 'rear', 'left', 'right', 'top'] as const) {
            scene.projection.setPhoto(side, photos[side]);
        }

        scene.projection.setEnabled(props.wrapPhotos === true);
    }, [photoKey, props.wrapPhotos, props.kind, engineKey, props.doors]);

    // Keep the floor in step with light and dark mode.
    useEffect(() => {
        const scene = state.current;

        if (!scene) {
            return;
        }

        const dark = props.appearance === 'dark';
        scene.ground.material.opacity = dark ? 0.5 : 0.28;
        (scene.grid.material as THREE.Material).opacity = dark ? 0.16 : 0.2;
        scene.renderer.toneMappingExposure = dark ? 0.95 : 1.05;
    }, [props.appearance, props.kind, engineKey, props.doors]);

    return (
        <div ref={container} className="h-full w-full touch-none select-none" />
    );
}

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Tint the hovered and selected parts so it is obvious what a click will do.
 */
function paint(scene: Scene, selected: EnginePartKey | null): void {
    for (const [key, meshes] of scene.parts) {
        for (const mesh of meshes) {
            const material = mesh.material as THREE.MeshStandardMaterial;
            const isSelected = key === selected;
            const isHovered = key === scene.hovered;

            material.emissive.copy(
                isSelected ? SELECTED : isHovered ? HOVER : NONE,
            );
            material.emissiveIntensity = isSelected
                ? 0.5
                : isHovered
                  ? 0.45
                  : 0;
        }
    }

    for (const mesh of scene.hotspotMeshes) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity =
            scene.hovered === 'engine'
                ? (material.userData.hoverOpacity as number)
                : (material.userData.baseOpacity as number);
    }
}

function buildScene(
    element: HTMLDivElement,
    kind: MachineKind,
    engine: EngineInput,
    doors: number | null,
): Scene {
    const width = element.clientWidth || 640;
    const height = element.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 300);

    // A studio room for reflections: this is what makes metal read as metal.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = environment;
    scene.environmentIntensity = 0.9;

    const m = makeMaterials();
    for (const material of bodyMaterials(m)) {
        material.userData.baseOpacity = material.opacity;
    }

    const body = new THREE.Group();
    const anchor = buildBody(kind, m, body, { doors });
    scene.add(body);

    const engineGroup = new THREE.Group();
    const parts = new Map<EnginePartKey, THREE.Mesh[]>();

    if (anchor.scale > 0) {
        buildEngine(engine, m, engineGroup, parts);
        const displacementScale = engine.displacement
            ? Math.min(1.3, Math.max(0.75, 0.8 + engine.displacement * 0.08))
            : 1;
        engineGroup.scale.setScalar(anchor.scale * displacementScale);
        engineGroup.position.copy(anchor.position);
        engineGroup.rotation.y = anchor.rotationY ?? 0;
    }

    engineGroup.visible = anchor.exposed === true;
    scene.add(engineGroup);

    const machineBox = new THREE.Box3().setFromObject(body);
    const machineSize = machineBox.getSize(new THREE.Vector3());
    const machineCentre = machineBox.getCenter(new THREE.Vector3());
    const span = Math.max(machineSize.x, machineSize.y, machineSize.z);

    // Photos of the real machine can be wrapped over the painted panels.
    const projection = installPhotoProjection([m.paint, m.paintDark, m.glass]);
    projection.setBounds(machineBox);

    // Lights: a warm-neutral key throwing a soft shadow, a cool fill, and a rim.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555560, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(machineCentre.x + span * 0.8, span * 1.4, span * 0.9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -span;
    key.shadow.camera.right = span;
    key.shadow.camera.top = span;
    key.shadow.camera.bottom = -span;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = span * 6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.target.position.copy(machineCentre);
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.5);
    fill.position.set(machineCentre.x - span, span * 0.6, -span);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(machineCentre.x - span * 0.5, span * 0.8, span * 1.2);
    scene.add(rim);

    // The floor only exists to catch the shadow; the page shows through it.
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(span * 1.6, 64),
        new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(machineCentre.x, 0, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(
        span * 2.4,
        Math.round(span * 4),
        0x888888,
        0x888888,
    );
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.2;
    grid.position.set(machineCentre.x, 0.002, 0);
    scene.add(grid);

    // The hotspot marks where the engine lives while the body is opaque.
    const hotspot = new THREE.Group();
    const hotspotMeshes: THREE.Mesh[] = [];

    if (anchor.scale > 0) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.03, 12, 48),
            m.hotspot.clone(),
        );
        ring.rotation.x = Math.PI / 2;
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 20, 20),
            m.hotspot.clone(),
        );
        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 20, 20),
            m.hotspot.clone(),
        );
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.08;

        for (const mesh of [ring, dot, halo]) {
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.userData.baseOpacity = material.opacity;
            material.userData.hoverOpacity = Math.min(
                1,
                material.opacity + 0.2,
            );
            mesh.userData.part = 'engine';
            hotspot.add(mesh);
            hotspotMeshes.push(mesh);
        }

        hotspot.position.set(
            anchor.position.x,
            machineBox.max.y + 0.3,
            anchor.position.z,
        );
        hotspot.userData.baseScale = Math.max(0.5, machineSize.x / 6);
        hotspot.scale.setScalar(hotspot.userData.baseScale as number);
    } else {
        hotspot.userData.baseScale = 1;
    }

    scene.add(hotspot);

    const machineFrame: Frame = {
        target: new THREE.Vector3(machineCentre.x, machineCentre.y * 0.85, 0),
        position: new THREE.Vector3(
            machineCentre.x + span * 1.0,
            span * 0.62,
            span * 1.35,
        ),
    };

    const engineBox =
        parts.size > 0
            ? new THREE.Box3().setFromObject(engineGroup)
            : machineBox;
    const engineCentre = engineBox.getCenter(new THREE.Vector3());
    const engineSpan = Math.max(
        ...engineBox.getSize(new THREE.Vector3()).toArray(),
    );
    const engineFrame: Frame = {
        target: engineCentre.clone(),
        position: engineCentre
            .clone()
            .add(
                new THREE.Vector3(
                    engineSpan * 1.0,
                    engineSpan * 0.75,
                    engineSpan * 1.35,
                ),
            ),
    };

    camera.position.copy(machineFrame.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.3;
    controls.maxDistance = span * 4;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.target.copy(machineFrame.target);

    return {
        renderer,
        scene,
        camera,
        controls,
        hotspot,
        engine: engineGroup,
        engineExposed: anchor.exposed === true,
        projection,
        ground,
        grid,
        environment,
        bodyMaterials: bodyMaterials(m),
        parts,
        hotspotMeshes,
        machineFrame,
        engineFrame,
        tween: null,
        fade: null,
        hovered: null,
        frame: 0,
    };
}
