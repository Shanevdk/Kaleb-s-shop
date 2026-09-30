import { Cog } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { EnginePartKey } from '@/lib/engine-parts';
import type { EngineInput } from '@/lib/three/engine';
import type { Anchor } from '@/lib/three/look';
import { buildMachine, shellMeshes, type Machine } from '@/lib/three/machine';
import { ghostMaterial } from '@/lib/three/materials';
import {
    installPhotoProjection,
    type PhotoProjection,
} from '@/lib/three/photos';
import { SEE_THROUGH_LAYER, Stage, type Appearance } from '@/lib/three/stage';
import { cn } from '@/lib/utils';
import { AREA_LABELS, SEVERITY_CLASSES } from '@/lib/vehicle-look';
import type {
    EngineSpecs,
    LookDamage,
    MachineKind,
    VehicleLook,
    VehiclePhotos,
} from '@/types';

export type ViewerView = 'machine' | 'engine';

export type MachineViewerProps = {
    kind: MachineKind;
    engine: Partial<EngineSpecs>;
    doors?: number | null;
    bodyClass?: string | null;
    driveType?: string | null;
    colour?: string | null;
    registration?: string | null;
    photos?: VehiclePhotos;
    wrapPhotos?: boolean;
    view: ViewerView;
    selectedPart: EnginePartKey | null;
    appearance: Appearance;
    /** What the AI read from the photos, to build the model to match. */
    look?: VehicleLook | null;
    /** Damage to pin on the model, numbered as it is listed. */
    damage?: LookDamage[];
    selectedDamage?: number | null;
    /** The pin to swing round to; a new nonce swings again. */
    focus?: { index: number; nonce: number } | null;
    onSelectDamage?: (index: number) => void;
    onViewChange: (view: ViewerView) => void;
    onHoverPart: (part: EnginePartKey | 'engine' | null) => void;
    onSelectPart: (part: EnginePartKey | null) => void;
    onPartsReady: (parts: EnginePartKey[]) => void;
};

type Frame = { position: THREE.Vector3; target: THREE.Vector3 };

type Viewer = {
    stage: Stage;
    machine: Machine;
    projection: PhotoProjection;
    ghost: THREE.ShaderMaterial;
    twins: THREE.Mesh[];
    shells: THREE.Mesh[];
    hidden: THREE.Object3D[];
    partMeshes: THREE.Mesh[];
    engineCovered: boolean;
    machineFrame: Frame;
    engineFrame: Frame;
    marker: THREE.Vector3 | null;
    /** Where each damage pin stands, in the order they are listed. */
    pins: (Anchor | null)[];
    radius: number;
    tween: { from: Frame; to: Frame; start: number; duration: number } | null;
    xray: { from: number; to: number; start: number } | null;
    amount: number;
    hovered: EnginePartKey | null;
};

const HOVER = new THREE.Color(0x3b82f6);
const SELECTED = new THREE.Color(0xf59e0b);
const BLACK = new THREE.Color(0x000000);

/**
 * Countries that drive on the left put the steering wheel on the right.
 */
function drivesOnTheLeft(): boolean {
    const region =
        typeof navigator === 'undefined'
            ? ''
            : (navigator.language.split('-')[1] ?? '').toUpperCase();

    return [
        'AU',
        'NZ',
        'GB',
        'IE',
        'ZA',
        'IN',
        'JP',
        'SG',
        'MY',
        'HK',
        'TH',
        'ID',
        'KE',
        'FJ',
    ].includes(region);
}

function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Frame an object from a three-quarter view, far enough back that it all
 * fits whatever the shape of the canvas.
 */
function frameFor(
    box: THREE.Box3,
    camera: THREE.PerspectiveCamera,
    azimuth: number,
    elevation: number,
    margin: number,
    lift = 0.82,
): Frame {
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const horizontal =
        2 * Math.atan(Math.tan(fov / 2) * Math.max(0.6, camera.aspect));
    const distance =
        (radius * margin) / Math.sin(Math.min(fov, horizontal) / 2);
    const target = new THREE.Vector3(centre.x, centre.y * lift, centre.z);
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(elevation);

    return {
        target,
        position: target
            .clone()
            .add(
                new THREE.Vector3(
                    Math.cos(el) * Math.cos(az),
                    Math.sin(el),
                    Math.cos(el) * Math.sin(az),
                ).multiplyScalar(distance),
            ),
    };
}

/**
 * Tint the hovered and selected parts so it is obvious what a click does.
 */
function paint(viewer: Viewer, selected: EnginePartKey | null): void {
    for (const [key, meshes] of viewer.machine.parts) {
        const isSelected = key === selected;
        const isHovered = key === viewer.hovered;

        for (const mesh of meshes) {
            const material = mesh.material as THREE.MeshStandardMaterial;

            if (!('emissive' in material)) {
                continue;
            }

            material.emissive.copy(
                isSelected ? SELECTED : isHovered ? HOVER : BLACK,
            );
            material.emissiveIntensity = isSelected
                ? 0.55
                : isHovered
                  ? 0.45
                  : 1;
        }
    }
}

/**
 * Crossfade between the solid body and its x-ray ghost. The solid body
 * goes early in the fade so the two never fight.
 */
function setXray(viewer: Viewer, amount: number): void {
    viewer.amount = amount;
    viewer.ghost.uniforms.strength.value = amount;

    for (const twin of viewer.twins) {
        twin.visible = amount > 0.001;
    }

    for (const shell of viewer.shells) {
        shell.visible = amount < 0.4;
    }

    for (const object of viewer.hidden) {
        object.visible = amount < 0.4;
    }

    viewer.machine.engine.visible = !viewer.engineCovered || amount > 0.001;
}

/**
 * A photo-real studio render of the machine with a clickable engine.
 *
 * The body is built for the kind of machine, in the vehicle's own paint,
 * and the engine from its specs at its true size. Clicking the marker over
 * the engine flies the camera in while the body turns to an x-ray outline,
 * and each part of the engine can then be picked out.
 */
export default function MachineViewer(props: MachineViewerProps) {
    const container = useRef<HTMLDivElement>(null);
    const marker = useRef<HTMLButtonElement>(null);
    const pinButtons = useRef<(HTMLButtonElement | null)[]>([]);
    const state = useRef<Viewer | null>(null);
    const latest = useRef(props);
    const [building, setBuilding] = useState(true);

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
    const bodyKey = JSON.stringify([
        props.kind,
        props.doors ?? null,
        props.bodyClass ?? null,
        props.driveType ?? null,
        props.colour ?? null,
        props.registration ?? null,
    ]);
    // Only what changes the build: the damage pins move without one.
    const lookKey = JSON.stringify(
        props.look
            ? [
                  props.look.colour,
                  props.look.body_style,
                  props.look.cab,
                  props.look.roof,
                  props.look.wheels,
                  props.look.tinted_windows,
                  props.look.accessories,
              ]
            : null,
    );
    const damageKey = JSON.stringify(
        (props.damage ?? []).map((mark) => mark.area),
    );

    // Build the scene once per machine, and tear it down completely after.
    useEffect(() => {
        const element = container.current;

        if (!element) {
            return;
        }

        let viewer: Viewer | null = null;
        let cancelled = false;
        const stage = new Stage(element, {
            appearance: latest.current.appearance,
        });
        setBuilding(true);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let pressed: { x: number; y: number } | null = null;

        const pick = (event: PointerEvent): EnginePartKey | null => {
            if (!viewer || latest.current.view !== 'engine') {
                return null;
            }

            const bounds = element.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, stage.camera);
            const hit = raycaster.intersectObjects(viewer.partMeshes, false)[0];

            return (
                (hit?.object.userData.part as EnginePartKey | undefined) ?? null
            );
        };

        const onMove = (event: PointerEvent) => {
            if (!viewer) {
                return;
            }

            const part = pick(event);

            if (part !== viewer.hovered) {
                viewer.hovered = part;
                element.style.cursor = part ? 'pointer' : '';
                latest.current.onHoverPart(part);
                paint(viewer, latest.current.selectedPart);
            }
        };

        const onDown = (event: PointerEvent) => {
            pressed = { x: event.clientX, y: event.clientY };
            stage.controls.autoRotate = false;
        };

        const onUp = (event: PointerEvent) => {
            if (!pressed || !viewer) {
                return;
            }

            const moved = Math.hypot(
                event.clientX - pressed.x,
                event.clientY - pressed.y,
            );
            pressed = null;

            if (moved > 6 || latest.current.view !== 'engine') {
                return;
            }

            latest.current.onSelectPart(pick(event));
        };

        const onLeave = () => {
            if (viewer && viewer.hovered !== null) {
                viewer.hovered = null;
                element.style.cursor = '';
                latest.current.onHoverPart(null);
                paint(viewer, latest.current.selectedPart);
            }
        };

        element.addEventListener('pointermove', onMove);
        element.addEventListener('pointerdown', onDown);
        element.addEventListener('pointerup', onUp);
        element.addEventListener('pointerleave', onLeave);

        // Let the page paint its loading state before the build takes the
        // main thread.
        const timer = window.setTimeout(() => {
            if (cancelled) {
                return;
            }

            const engine = JSON.parse(engineKey) as EngineInput;
            const machine = buildMachine({
                kind: latest.current.kind,
                engine,
                doors: latest.current.doors ?? null,
                bodyClass: latest.current.bodyClass ?? null,
                driveType: latest.current.driveType ?? null,
                colour: latest.current.colour ?? null,
                registration: latest.current.registration ?? null,
                look: latest.current.look ?? null,
                rightHandDrive: drivesOnTheLeft(),
                // A third level looks no different on screen and costs
                // half a second more of blocked main thread.
                levels: 2,
            });
            stage.scene.add(machine.root);
            const bounds = stage.setSubject(machine.body);
            const m = machine.materials;
            const projection = installPhotoProjection([
                m.paint,
                m.paintDark,
                m.enamel,
                m.plastic,
                m.gloss,
            ]);
            projection.setBounds(bounds);

            // Ghost twins of the bodywork share its geometry.
            const ghost = ghostMaterial();
            const { ghost: shells, hide } = shellMeshes(machine);
            const twins: THREE.Mesh[] = [];
            machine.root.updateMatrixWorld(true);

            for (const shell of shells) {
                const twin =
                    shell instanceof THREE.InstancedMesh
                        ? new THREE.InstancedMesh(
                              shell.geometry,
                              ghost,
                              shell.count,
                          )
                        : new THREE.Mesh(shell.geometry, ghost);

                if (
                    twin instanceof THREE.InstancedMesh &&
                    shell instanceof THREE.InstancedMesh
                ) {
                    twin.instanceMatrix = shell.instanceMatrix;
                }

                twin.matrixAutoUpdate = false;
                twin.matrix.copy(shell.matrix);
                twin.layers.set(SEE_THROUGH_LAYER);
                twin.visible = false;
                twin.renderOrder = 5;
                shell.parent?.add(twin);
                twins.push(twin);
            }

            for (const mesh of shells) {
                if (mesh.userData.seeThrough) {
                    mesh.layers.set(SEE_THROUGH_LAYER);
                }
            }

            const engineBox = new THREE.Box3();

            for (const meshes of machine.parts.values()) {
                for (const mesh of meshes) {
                    engineBox.expandByObject(mesh);
                }
            }

            // The marker floats just above the body over the engine.
            let markerPoint: THREE.Vector3 | null = null;

            if (machine.bay && !engineBox.isEmpty()) {
                const centre = engineBox.getCenter(new THREE.Vector3());
                const ray = new THREE.Raycaster(
                    new THREE.Vector3(centre.x, bounds.max.y + 2, centre.z),
                    new THREE.Vector3(0, -1, 0),
                );
                const hit = ray.intersectObject(machine.body, true)[0];
                markerPoint = new THREE.Vector3(
                    centre.x,
                    (hit?.point.y ?? engineBox.max.y) + 0.16,
                    centre.z,
                );
            }

            viewer = {
                stage,
                machine,
                projection,
                ghost,
                twins,
                shells,
                hidden: hide,
                partMeshes: [...machine.parts.values()].flat(),
                engineCovered: machine.bay?.exposed !== true,
                machineFrame: frameFor(bounds, stage.camera, 38, 13, 0.92),
                engineFrame: engineBox.isEmpty()
                    ? frameFor(bounds, stage.camera, 38, 13, 0.92)
                    : frameFor(engineBox, stage.camera, 42, 30, 1.0, 1),
                marker: markerPoint,
                pins: [],
                radius: bounds.getBoundingSphere(new THREE.Sphere()).radius,
                tween: null,
                xray: null,
                amount: 0,
                hovered: null,
            };
            state.current = viewer;
            setXray(viewer, 0);
            applyAppearance(viewer, latest.current.appearance);

            const start =
                latest.current.view === 'engine'
                    ? viewer.engineFrame
                    : viewer.machineFrame;
            stage.camera.position.copy(start.position);
            stage.controls.target.copy(start.target);
            stage.controls.maxDistance =
                bounds.getBoundingSphere(new THREE.Sphere()).radius * 6;
            stage.controls.minDistance = 0.25;
            stage.controls.maxPolarAngle = Math.PI / 2 - 0.04;
            stage.controls.autoRotate = latest.current.view === 'machine';

            if (latest.current.view === 'engine') {
                setXray(viewer, 1);
            }

            latest.current.onPartsReady([...machine.parts.keys()]);
            setBuilding(false);

            stage.start((now) => {
                if (!viewer) {
                    return;
                }

                if (viewer.tween) {
                    const t = easeInOut(
                        Math.min(
                            1,
                            (now - viewer.tween.start) / viewer.tween.duration,
                        ),
                    );
                    stage.camera.position.lerpVectors(
                        viewer.tween.from.position,
                        viewer.tween.to.position,
                        t,
                    );
                    stage.controls.target.lerpVectors(
                        viewer.tween.from.target,
                        viewer.tween.to.target,
                        t,
                    );

                    if (t >= 1) {
                        viewer.tween = null;
                    }
                }

                if (viewer.xray) {
                    const t = Math.min(1, (now - viewer.xray.start) / 650);
                    setXray(
                        viewer,
                        viewer.xray.from +
                            (viewer.xray.to - viewer.xray.from) * easeInOut(t),
                    );

                    if (t >= 1) {
                        viewer.xray = null;
                    }
                }

                const button = marker.current;

                if (button && viewer.marker) {
                    const projected = viewer.marker
                        .clone()
                        .project(stage.camera);
                    const visible =
                        latest.current.view === 'machine' &&
                        viewer.amount < 0.05 &&
                        projected.z < 1;
                    button.style.opacity = visible ? '1' : '0';
                    button.style.pointerEvents = visible ? 'auto' : 'none';
                    button.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * element.clientWidth}px, ${((1 - projected.y) / 2) * element.clientHeight}px)`;
                }

                // Damage pins stand on the body and hide round the back.
                const toCamera = new THREE.Vector3();
                const xray = viewer.amount;

                viewer.pins.forEach((pin, index) => {
                    const pinButton = pinButtons.current[index];

                    if (!pinButton) {
                        return;
                    }

                    if (!pin) {
                        pinButton.style.opacity = '0';
                        pinButton.style.pointerEvents = 'none';

                        return;
                    }

                    const projected = pin.position
                        .clone()
                        .project(stage.camera);
                    toCamera.copy(stage.camera.position).sub(pin.position);
                    const visible =
                        latest.current.view === 'machine' &&
                        xray < 0.05 &&
                        projected.z < 1 &&
                        pin.normal.dot(toCamera) > 0;
                    pinButton.style.opacity = visible ? '1' : '0';
                    pinButton.style.pointerEvents = visible ? 'auto' : 'none';
                    pinButton.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * element.clientWidth}px, ${((1 - projected.y) / 2) * element.clientHeight}px)`;
                });
            });
        }, 30);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            element.removeEventListener('pointermove', onMove);
            element.removeEventListener('pointerdown', onDown);
            element.removeEventListener('pointerup', onUp);
            element.removeEventListener('pointerleave', onLeave);

            if (viewer) {
                const disposed = new Set<
                    THREE.Material | THREE.BufferGeometry
                >();
                viewer.machine.root.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        disposed.add(object.geometry);
                        const materials = Array.isArray(object.material)
                            ? object.material
                            : [object.material];
                        materials.forEach((material) => disposed.add(material));
                    }
                });
                disposed.forEach((resource) => resource.dispose());
                viewer.projection.dispose();
            }

            stage.dispose();
            state.current = null;
        };
        // The engine and body are compared by value through their keys.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engineKey, bodyKey, lookKey]);

    // Stand a pin on the body for each piece of damage, stepping pins on
    // the same area apart so none hides another.
    useEffect(() => {
        const viewer = state.current;

        if (!viewer) {
            return;
        }

        const areas = JSON.parse(damageKey) as LookDamage['area'][];
        const seen = new Map<string, number>();
        viewer.pins = areas.map((area) => {
            const anchor = viewer.machine.anchor(area);
            const count = seen.get(area) ?? 0;
            seen.set(area, count + 1);

            if (!anchor) {
                return null;
            }

            return {
                position: anchor.position
                    .clone()
                    .addScaledVector(anchor.normal, 0.03)
                    .add(new THREE.Vector3(0, count * 0.1, 0)),
                normal: anchor.normal,
            };
        });
    }, [damageKey, engineKey, bodyKey, lookKey, building]);

    // Swing round to face a pin when one is picked from the list.
    useEffect(() => {
        const viewer = state.current;
        const focus = props.focus;

        if (!viewer || !focus) {
            return;
        }

        const pin = viewer.pins[focus.index];

        if (!pin) {
            return;
        }

        const distance = Math.max(1.3, viewer.radius * 0.85);
        const position = pin.position
            .clone()
            .addScaledVector(pin.normal, distance)
            .add(new THREE.Vector3(0, distance * 0.3, 0));
        position.y = Math.max(position.y, 0.35);
        viewer.tween = {
            from: {
                position: viewer.stage.camera.position.clone(),
                target: viewer.stage.controls.target.clone(),
            },
            to: { position, target: pin.position.clone() },
            start: performance.now(),
            duration: 900,
        };
        viewer.stage.controls.autoRotate = false;
        // Only a new pick swings the camera.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.focus?.nonce]);

    // Fly between the whole machine and the engine.
    useEffect(() => {
        const viewer = state.current;

        if (!viewer) {
            return;
        }

        const to =
            props.view === 'engine' ? viewer.engineFrame : viewer.machineFrame;
        const now = performance.now();
        viewer.tween = {
            from: {
                position: viewer.stage.camera.position.clone(),
                target: viewer.stage.controls.target.clone(),
            },
            to: { position: to.position.clone(), target: to.target.clone() },
            start: now,
            duration: 1000,
        };
        viewer.xray = {
            from: viewer.amount,
            to: props.view === 'engine' ? 1 : 0,
            start: now,
        };
        viewer.stage.controls.autoRotate = props.view === 'machine';
        viewer.hovered = null;
        paint(viewer, props.selectedPart);
        // A rebuilt scene must land on the right frame too.
    }, [props.view, props.selectedPart, engineKey, bodyKey, lookKey, building]);

    // Wrap the walk-around photos over the body when asked to.
    const photoKey = JSON.stringify({
        front: props.photos?.front ?? null,
        rear: props.photos?.rear ?? null,
        left: props.photos?.left ?? null,
        right: props.photos?.right ?? null,
        top: props.photos?.top ?? null,
    });

    useEffect(() => {
        const viewer = state.current;

        if (!viewer) {
            return;
        }

        const photos = JSON.parse(photoKey) as Record<
            'front' | 'rear' | 'left' | 'right' | 'top',
            string | null
        >;

        for (const side of ['front', 'rear', 'left', 'right', 'top'] as const) {
            viewer.projection.setPhoto(side, photos[side]);
        }

        viewer.projection.setEnabled(props.wrapPhotos === true);
    }, [photoKey, props.wrapPhotos, engineKey, bodyKey, lookKey, building]);

    // Keep the floor and the ghost in step with light and dark mode.
    useEffect(() => {
        const viewer = state.current;

        if (viewer) {
            applyAppearance(viewer, props.appearance);
        }
    }, [props.appearance, engineKey, bodyKey, lookKey, building]);

    return (
        <div
            ref={container}
            className="relative h-full w-full touch-none select-none"
        >
            {building && (
                <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs">
                    Building the model…
                </div>
            )}
            <button
                ref={marker}
                type="button"
                aria-label="Open the engine bay"
                onClick={() => latest.current.onViewChange('engine')}
                onPointerEnter={() => latest.current.onHoverPart('engine')}
                onPointerLeave={() => latest.current.onHoverPart(null)}
                className="group absolute top-0 left-0 z-10 flex size-9 items-center justify-center opacity-0 transition-opacity duration-300"
            >
                <span className="absolute inline-flex size-9 animate-ping rounded-full bg-amber-400/40" />
                <span className="relative inline-flex size-7 items-center justify-center rounded-full border border-white/70 bg-amber-500 text-white shadow-lg transition-transform group-hover:scale-110">
                    <Cog className="size-4" />
                </span>
            </button>
            {(props.damage ?? []).map((mark, index) => (
                <button
                    key={index}
                    ref={(element) => {
                        pinButtons.current[index] = element;
                    }}
                    type="button"
                    title={`${AREA_LABELS[mark.area]}: ${mark.note}`}
                    aria-label={`Damage ${index + 1}: ${AREA_LABELS[mark.area]}`}
                    onClick={() => latest.current.onSelectDamage?.(index)}
                    className={cn(
                        'absolute top-0 left-0 z-10 flex size-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-md transition-[opacity,scale] duration-200',
                        SEVERITY_CLASSES[mark.severity],
                        props.selectedDamage === index &&
                            'ring-primary scale-125 ring-2',
                    )}
                    style={{ opacity: 0 }}
                >
                    {index + 1}
                </button>
            ))}
        </div>
    );
}

function applyAppearance(viewer: Viewer, appearance: Appearance): void {
    viewer.stage.setAppearance(appearance);
    viewer.ghost.uniforms.colour.value.set(
        appearance === 'dark' ? 0xa9bcd4 : 0x3d4a5c,
    );
}
