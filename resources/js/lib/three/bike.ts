import * as THREE from 'three';
import type { Materials } from '@/lib/three/materials';
import type { EngineBay } from '@/lib/three/road';
import { clonePatched } from '@/lib/three/shading';
import {
    bentTube,
    box,
    cyl,
    instanced,
    lathe,
    puck,
    rod,
    torus,
    tube,
    type Point3,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import {
    buildRim,
    buildTyre,
    buildWheel,
    rimRadius,
    tyreRadius,
    type TyreSpec,
    type WheelSpec,
} from '@/lib/three/wheels';

/**
 * A helical coil spring between two points, for shocks.
 */
export function coilSpring(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    wire: number,
    turns: number,
    material: THREE.Material,
): THREE.Mesh {
    const axis = to.clone().sub(from);
    const length = axis.length();
    const points: Point3[] = [];
    const steps = turns * 16;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * turns * Math.PI * 2;
        points.push([Math.cos(a) * radius, t * length, Math.sin(a) * radius]);
    }

    const spring = tube(points, wire, material, {
        segments: steps * 2,
        radial: 8,
    });
    spring.position.copy(from);
    spring.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        axis.normalize(),
    );

    return spring;
}

/**
 * A brake disc for a motorcycle: a thin wavy rotor on carriers, cross
 * drilled, round a hub.
 */
function wavyDisc(m: Materials, radius: number): THREE.Group {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const lobes = 12;

    for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const r = radius - 0.006 + Math.cos(a * lobes) * 0.005;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;

        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }

    const inner = new THREE.Path();
    inner.absarc(0, 0, radius * 0.66, 0, Math.PI * 2, true);
    shape.holes.push(inner);

    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const r = radius * (i % 2 === 0 ? 0.8 : 0.88);
        const drill = new THREE.Path();
        drill.absarc(
            Math.cos(a) * r,
            Math.sin(a) * r,
            0.0045,
            0,
            Math.PI * 2,
            true,
        );
        shape.holes.push(drill);
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.005,
        bevelEnabled: false,
        curveSegments: 12,
    });
    geometry.translate(0, 0, -0.0025);
    group.add(new THREE.Mesh(geometry, m.disc));

    // Carrier spokes to the hub.
    for (let i = 0; i < 6; i++) {
        const spoke = box(
            radius * 0.5,
            0.018,
            0.008,
            m.alloyPaint,
            0,
            0,
            0,
            0.003,
        );
        const a = (i / 6) * Math.PI * 2;
        spoke.position.set(
            Math.cos(a) * radius * 0.42,
            Math.sin(a) * radius * 0.42,
            0,
        );
        spoke.rotation.z = a;
        group.add(spoke);
    }

    return group;
}

function bikeWheel(
    m: Materials,
    tyre: TyreSpec,
    discs: number,
    sprocket: boolean,
): THREE.Group {
    const group = new THREE.Group();
    const spec: WheelSpec = { tyre, rim: 'moto', brake: 'none' };
    group.add(buildTyre(m, tyre), buildRim(m, spec));
    const R = rimRadius(tyre);
    const offsets = discs === 2 ? [0.075, -0.075] : discs === 1 ? [0.07] : [];

    for (const z of offsets) {
        const disc = wavyDisc(m, discs === 2 ? 0.16 : 0.12);
        disc.position.z = z;
        group.add(disc);
    }

    group.add(
        cyl(0.045, tyre.width * 1.1, m.alloyPaint, 'z', 0, 0, 0, {
            segments: 24,
        }),
    );
    group.add(cyl(0.012, tyre.width * 1.5, m.steel, 'z'));

    if (sprocket) {
        // Rear sprocket with teeth, on the left.
        const teeth = 42;
        const pitch = R * 0.72;
        const sprocketGroup = new THREE.Group();
        sprocketGroup.add(puck(pitch, 0.006, m.steel, 'z', 0, 0, 0));
        sprocketGroup.add(
            instanced(
                new THREE.BoxGeometry(0.009, 0.012, 0.006),
                m.steel,
                Array.from({ length: teeth }, (_, i) => {
                    const a = (i / teeth) * Math.PI * 2;

                    return {
                        x: Math.cos(a) * (pitch + 0.004),
                        y: Math.sin(a) * (pitch + 0.004),
                        z: 0,
                        rz: a,
                    };
                }),
            ),
        );
        sprocketGroup.position.z = -0.085;
        group.add(sprocketGroup);
    }

    group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    return group;
}

/**
 * A naked middleweight: steel trellis frame, upside-down forks, twin
 * front discs, sculpted tank, stepped seat, aluminium swingarm on a
 * rising-rate mono-shock, chain drive, underbelly exhaust. It rests on
 * its side stand, leaning a few degrees to the left.
 */
export function buildMotorcycle(m: Materials, group: THREE.Group): EngineBay {
    const bike = new THREE.Group();
    group.add(bike);

    const frontTyre: TyreSpec = {
        width: 0.12,
        aspect: 0.7,
        rim: 17,
        tread: 'moto',
        label: 'ZR  58W',
    };
    const rearTyre: TyreSpec = {
        width: 0.18,
        aspect: 0.55,
        rim: 17,
        tread: 'moto',
        label: 'ZR  73W',
    };
    const Rf = tyreRadius(frontTyre);
    const Rr = tyreRadius(rearTyre);
    const front = new THREE.Vector3(0.72, Rf, 0);
    const rear = new THREE.Vector3(-0.71, Rr, 0);
    const frame = clonePatched(m.red);
    (frame as THREE.MeshStandardMaterial).metalness = 0.4;
    (frame as THREE.MeshStandardMaterial).roughness = 0.35;

    const frontWheel = bikeWheel(m, frontTyre, 2, false);
    frontWheel.position.copy(front);
    frontWheel.rotation.y = 0.08;
    bike.add(frontWheel);
    const rearWheel = bikeWheel(m, rearTyre, 1, true);
    rearWheel.position.copy(rear);
    bike.add(rearWheel);

    // Forks: gold upper tubes, chrome stanchions, axle clamps, calipers.
    const head = new THREE.Vector3(0.44, 0.98, 0);
    const lowerClamp = new THREE.Vector3(0.49, 0.86, 0);
    const forkDirection = front.clone().sub(lowerClamp).normalize();
    const gold = new THREE.MeshStandardMaterial({
        color: 0xc8962e,
        metalness: 1,
        roughness: 0.25,
    });

    for (const side of [1, -1]) {
        const z = side * 0.1;
        const top = new THREE.Vector3(
            head.x - forkDirection.x * 0.04,
            head.y + 0.04,
            z,
        );
        const joint = lowerClamp.clone().addScaledVector(forkDirection, 0.28);
        joint.z = z;
        const axle = front.clone();
        axle.z = z;
        bike.add(
            rod(
                top.toArray() as Point3,
                joint.toArray() as Point3,
                0.028,
                gold,
                24,
            ),
        );
        bike.add(
            rod(
                joint.toArray() as Point3,
                axle
                    .clone()
                    .addScaledVector(forkDirection, -0.05)
                    .toArray() as Point3,
                0.02,
                m.chrome,
                20,
            ),
        );
        const foot = box(
            0.06,
            0.1,
            0.05,
            m.alloyPaint,
            axle.x - 0.01,
            axle.y + 0.03,
            z,
            0.012,
        );
        foot.rotation.z = Math.atan2(forkDirection.x, -forkDirection.y);
        bike.add(foot);
        const caliper = box(
            0.045,
            0.1,
            0.035,
            gold,
            axle.x - 0.1,
            axle.y + 0.1,
            z * 0.78,
            0.012,
        );
        caliper.rotation.z = 0.7;
        bike.add(caliper);
    }

    // Triple clamps, bars, levers, mirrors, instrument, headlight.
    bike.add(
        softBox(0.1, 0.03, 0.3, m.alloyPaint, head.x, head.y + 0.03, 0, {
            crease: 0.5,
        }),
    );
    bike.add(
        softBox(0.1, 0.04, 0.3, m.alloyPaint, lowerClamp.x, lowerClamp.y, 0, {
            crease: 0.5,
        }),
    );
    bike.add(cyl(0.035, 0.16, frame, 'y', 0.465, 0.92, 0));
    bike.add(
        bentTube(
            [
                [0.34, 1.08, 0.38],
                [0.4, 1.07, 0.2],
                [0.43, 1.06, 0.07],
                [0.43, 1.06, -0.07],
                [0.4, 1.07, -0.2],
                [0.34, 1.08, -0.38],
            ],
            0.011,
            m.gloss,
            0.06,
        ),
    );

    for (const side of [1, -1]) {
        bike.add(cyl(0.018, 0.13, m.rubber, 'z', 0.33, 1.08, side * 0.43));
        bike.add(
            softBox(0.05, 0.04, 0.05, m.gloss, 0.36, 1.075, side * 0.34, {
                crease: 0.3,
            }),
        );
        const lever = rod(
            [0.38, 1.07, side * 0.33],
            [0.39, 1.06, side * 0.47],
            0.006,
            m.alloyPaint,
        );
        bike.add(lever);
        bike.add(
            rod(
                [0.37, 1.08, side * 0.3],
                [0.33, 1.25, side * 0.36],
                0.006,
                m.gloss,
            ),
        );
        bike.add(
            softBox(0.03, 0.07, 0.11, m.gloss, 0.33, 1.27, side * 0.37, {
                crease: 0.4,
            }),
        );
        bike.add(
            box(0.004, 0.06, 0.1, m.mirror, 0.314, 1.27, side * 0.37, 0.002),
        );
    }

    bike.add(softBox(0.04, 0.09, 0.14, m.gloss, 0.5, 1.07, 0, { crease: 0.5 }));
    bike.add(box(0.005, 0.07, 0.11, m.glass, 0.522, 1.075, 0, 0.004));
    const lamp = new THREE.Group();
    lamp.position.set(0.6, 0.92, 0);
    lamp.add(puck(0.095, 0.09, m.gloss, 'x', 0, 0, 0));
    lamp.add(
        lathe(
            [
                [0.02, -0.03],
                [0.07, -0.012],
                [0.085, 0.01],
            ],
            m.reflector,
            'x',
            0.02,
            0,
            0,
        ),
    );
    lamp.add(
        torus(0.05, 0.006, m.led, 'x', 0.035, 0, 0, { radial: 8, tubular: 40 }),
    );
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.086,
            32,
            12,
            0,
            Math.PI * 2,
            0,
            Math.PI / 3.4,
        ),
        m.lens,
    );
    dome.rotation.z = -Math.PI / 2;
    dome.position.x = -0.012;
    lamp.add(dome);
    bike.add(lamp);

    for (const side of [1, -1]) {
        bike.add(
            rod(
                [0.52, 0.94, side * 0.1],
                [0.55, 0.95, side * 0.2],
                0.006,
                m.gloss,
            ),
        );
        bike.add(
            softBox(0.05, 0.025, 0.03, m.amberLens, 0.56, 0.95, side * 0.21, {
                crease: 0.4,
            }),
        );
    }

    // Front mudguard hugging the tyre.
    const guard = torus(Rf + 0.035, 0.03, m.paint, 'z', front.x, front.y, 0, {
        arc: Math.PI * 0.55,
        start: Math.PI * 0.28,
        radial: 10,
        tubular: 32,
    });
    guard.scale.z = 2.6;
    bike.add(guard);

    // Steel trellis frame: two main rails from the head to the swingarm
    // pivot, braced with a lattice, and a subframe under the seat.
    const pivot = new THREE.Vector3(-0.27, 0.46, 0);

    for (const side of [1, -1]) {
        const z = side * 0.11;
        const upper: Point3[] = [
            [head.x, head.y - 0.04, side * 0.05],
            [0.2, 0.86, z],
            [-0.08, 0.76, z],
            [-0.24, 0.66, z],
        ];
        const lower: Point3[] = [
            [lowerClamp.x - 0.02, lowerClamp.y - 0.04, side * 0.05],
            [0.22, 0.62, z],
            [-0.02, 0.56, z],
            [pivot.x + 0.02, pivot.y + 0.04, z],
        ];
        bike.add(bentTube(upper, 0.014, frame, 0.08));
        bike.add(bentTube(lower, 0.014, frame, 0.08));

        for (let i = 0; i < 3; i++) {
            bike.add(rod(upper[i + 1], lower[i + 1], 0.011, frame));
            bike.add(rod(upper[i], lower[i + 1], 0.01, frame));
        }

        bike.add(
            rod([-0.24, 0.66, z], [pivot.x, pivot.y + 0.06, z], 0.016, frame),
        );

        // Subframe to the tail.
        bike.add(
            bentTube(
                [
                    [-0.2, 0.74, z * 0.9],
                    [-0.55, 0.82, z * 0.75],
                    [-0.86, 0.88, z * 0.5],
                ],
                0.011,
                m.gloss,
                0.05,
            ),
        );
        bike.add(rod([-0.26, 0.6, z], [-0.55, 0.81, z * 0.75], 0.009, m.gloss));

        // Footpegs and hangers.
        bike.add(
            softBox(0.14, 0.05, 0.02, m.alloyPaint, -0.2, 0.4, side * 0.15, {
                crease: 0.4,
            }),
        );
        bike.add(cyl(0.011, 0.09, m.rubber, 'z', -0.22, 0.38, side * 0.2));
        bike.add(
            rod(
                [-0.4, 0.55, side * 0.13],
                [-0.48, 0.47, side * 0.15],
                0.008,
                m.alloyPaint,
            ),
        );
        bike.add(cyl(0.01, 0.08, m.rubber, 'z', -0.49, 0.46, side * 0.19));
    }

    // Swingarm: box-section arms from the pivot to the axle, braced.
    for (const side of [1, -1]) {
        const arm = softBox(0.46, 0.07, 0.035, m.alloyPaint, 0, 0, 0, {
            crease: 0.6,
            divisions: [3, 1, 1],
            shape: (p) => {
                // Deeper at the pivot.
                p.y *= 1 + (p.x / 0.23) * 0.35;
            },
        });
        arm.position.set(
            (pivot.x + rear.x) / 2,
            (pivot.y + rear.y) / 2,
            side * 0.12,
        );
        arm.rotation.z = Math.atan2(pivot.y - rear.y, pivot.x - rear.x);
        bike.add(arm);
    }

    bike.add(
        box(
            0.05,
            0.05,
            0.24,
            m.alloyPaint,
            pivot.x - 0.12,
            pivot.y - 0.02,
            0,
            0.012,
        ),
    );
    bike.add(cyl(0.02, 0.3, m.steel, 'z', pivot.x, pivot.y, 0));

    // Mono-shock with its spring, from the swingarm up to the frame.
    const shockBottom = new THREE.Vector3(pivot.x - 0.1, pivot.y - 0.02, 0);
    const shockTop = new THREE.Vector3(-0.2, 0.72, 0);
    bike.add(
        rod(
            shockBottom.toArray() as Point3,
            shockTop.toArray() as Point3,
            0.018,
            m.gloss,
        ),
    );
    bike.add(
        coilSpring(
            shockBottom.clone().lerp(shockTop, 0.12),
            shockBottom.clone().lerp(shockTop, 0.75),
            0.03,
            0.006,
            7,
            m.red,
        ),
    );

    // Chain between the sprockets on the left, and the front sprocket.
    const frontSprocket = new THREE.Vector3(-0.12, 0.42, -0.085);
    bike.add(
        puck(
            0.04,
            0.008,
            m.steel,
            'z',
            frontSprocket.x,
            frontSprocket.y,
            frontSprocket.z,
        ),
    );
    const pitch = rimRadius(rearTyre) * 0.72 + 0.004;
    bike.add(
        tube(
            [
                [frontSprocket.x, frontSprocket.y + 0.045, -0.085],
                [rear.x, rear.y + pitch, -0.085],
                [rear.x - pitch, rear.y, -0.085],
                [rear.x, rear.y - pitch, -0.085],
                [frontSprocket.x, frontSprocket.y - 0.045, -0.085],
                [frontSprocket.x + 0.045, frontSprocket.y, -0.085],
            ],
            0.005,
            m.castIron,
            { closed: true, segments: 160, radial: 6, tension: 0.1 },
        ),
    );
    bike.add(box(0.3, 0.012, 0.03, m.plastic, -0.42, 0.52, -0.1, 0.004));

    // Tank, seats, tail, number plate.
    const tank = softBox(0.58, 0.27, 0.36, m.paint, 0.1, 0.94, 0, {
        divisions: [3, 2, 2],
        levels: 3,
        shape: (p) => {
            const back = Math.max(0, -p.x) / 0.29;
            const up = (p.y + 0.135) / 0.27;
            // Narrow at the knees, domed on top, the nose tucked down.
            p.z *= 1 - back * 0.32 - up * 0.18;
            p.y += Math.max(0, p.x) * 0.25 - back * 0.03;
            p.y -= Math.pow(Math.max(0, p.x) / 0.29, 2) * 0.05;
        },
    });
    bike.add(tank);
    bike.add(cyl(0.035, 0.012, m.satin, 'y', 0.12, 1.1, 0));
    bike.add(
        softBox(0.36, 0.08, 0.28, m.seat, -0.34, 0.86, 0, {
            divisions: [2, 1, 2],
            shape: (p) => {
                p.z *= 1 - Math.max(0, p.x) * 1.2;
                p.y += Math.max(0, p.x) * 0.2;
            },
        }),
    );
    bike.add(
        softBox(0.24, 0.07, 0.22, m.seat, -0.62, 0.92, 0, {
            divisions: [2, 1, 2],
        }),
    );
    const tail = softBox(0.4, 0.12, 0.2, m.paint, -0.72, 0.88, 0, {
        divisions: [3, 1, 2],
        shape: (p) => {
            const back = Math.max(0, -p.x) / 0.2;
            p.z *= 1 - back * 0.55;
            p.y *= 1 - back * 0.4;
            p.y += back * 0.02;
        },
    });
    bike.add(tail);
    bike.add(
        softBox(0.04, 0.03, 0.08, m.redLens, -0.915, 0.9, 0, { crease: 0.4 }),
    );
    bike.add(rod([-0.86, 0.82, 0], [-0.98, 0.62, 0], 0.012, m.gloss));
    const plate = box(0.005, 0.12, 0.18, m.plate, -0.99, 0.6, 0, 0.003);
    plate.rotation.z = -0.35;
    bike.add(plate);

    for (const side of [1, -1]) {
        bike.add(
            rod(
                [-0.95, 0.66, side * 0.02],
                [-0.96, 0.66, side * 0.13],
                0.005,
                m.gloss,
            ),
        );
        bike.add(
            softBox(0.04, 0.02, 0.03, m.amberLens, -0.96, 0.66, side * 0.14, {
                crease: 0.4,
            }),
        );
    }

    // Rear hugger over the tyre.
    const hugger = torus(Rr + 0.03, 0.025, m.plastic, 'z', rear.x, rear.y, 0, {
        arc: Math.PI * 0.4,
        start: Math.PI * 0.35,
        radial: 8,
        tubular: 24,
    });
    hugger.scale.z = 3.2;
    bike.add(hugger);

    // A stubby silencer tucked beneath the swingarm pivot. The engine
    // brings its headers and its radiator with it.
    bike.add(
        softBox(0.36, 0.14, 0.2, m.stainless, -0.22, 0.24, 0.02, {
            crease: 0.8,
            divisions: [3, 1, 1],
        }),
    );
    bike.add(cyl(0.028, 0.05, m.gloss, 'x', -0.42, 0.24, 0.05));

    // Side stand, down on the left.
    bike.add(rod([-0.12, 0.38, -0.12], [-0.02, 0.05, -0.3], 0.012, m.gloss));
    bike.add(box(0.05, 0.01, 0.04, m.gloss, -0.02, 0.042, -0.3, 0.003));

    // Resting on the stand: lean about the contact line.
    bike.rotation.x = -0.12;
    bike.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return {
        position: new THREE.Vector3(0.05, 0.44, 0),
        room: new THREE.Vector3(0.44, 0.46, 0.42),
        rotationY: Math.PI / 2,
        exposed: true,
        lean: -0.12,
        exhaust: new THREE.Vector3(0, -0.2, -0.09),
    };
}

/**
 * A utility quad: tube frame, plastic fenders with lamps, racks front and
 * back, double wishbones and coil-overs at the front, knobbly tyres on
 * steel rims, the engine out in the open under the seat.
 */
export function buildAtv(m: Materials, group: THREE.Group): EngineBay {
    const frontTyre: TyreSpec = {
        width: 0.2,
        aspect: 0.62,
        rim: 12,
        tread: 'knobby',
        label: 'AT25X8-12',
    };
    const rearTyre: TyreSpec = {
        width: 0.25,
        aspect: 0.5,
        rim: 12,
        tread: 'knobby',
        label: 'AT25X10-12',
    };
    const R = tyreRadius(frontTyre);
    const axles: [number, number] = [0.64, -0.62];
    const track = 0.5;
    const quad = new THREE.Group();
    group.add(quad);

    for (const [x, tyre] of [
        [axles[0], frontTyre],
        [axles[1], rearTyre],
    ] as [number, TyreSpec][]) {
        for (const side of [1, -1] as const) {
            const wheel = buildWheel(
                m,
                { tyre, rim: 'atv', brake: 'none', studs: 4 },
                side,
            );
            wheel.position.set(x, tyreRadius(tyre), side * track);
            quad.add(wheel);
        }
    }

    // Frame rails and floorboards.
    for (const side of [1, -1]) {
        const z = side * 0.2;
        quad.add(
            bentTube(
                [
                    [0.78, 0.42, z * 0.8],
                    [0.6, 0.3, z],
                    [-0.58, 0.3, z],
                    [-0.8, 0.44, z * 0.9],
                ],
                0.02,
                m.gloss,
                0.1,
            ),
        );
        quad.add(
            bentTube(
                [
                    [0.45, 0.3, z],
                    [0.4, 0.72, z * 0.8],
                    [-0.3, 0.76, z * 0.8],
                    [-0.42, 0.3, z],
                ],
                0.018,
                m.gloss,
                0.08,
            ),
        );
        quad.add(
            softBox(0.62, 0.03, 0.2, m.plastic, -0.02, 0.36, side * 0.38, {
                crease: 0.6,
                divisions: [3, 1, 1],
            }),
        );

        // Front double wishbones with a coil-over shock.
        for (const y of [0.28, 0.42]) {
            quad.add(
                rod(
                    [axles[0] + 0.08, y, side * 0.16],
                    [axles[0], y + 0.02, side * (track - 0.12)],
                    0.013,
                    m.gloss,
                ),
            );
            quad.add(
                rod(
                    [axles[0] - 0.1, y, side * 0.16],
                    [axles[0], y + 0.02, side * (track - 0.12)],
                    0.013,
                    m.gloss,
                ),
            );
        }

        quad.add(
            box(
                0.06,
                0.16,
                0.05,
                m.castIron,
                axles[0],
                R,
                side * (track - 0.11),
                0.01,
            ),
        );
        const shockBottom = new THREE.Vector3(
            axles[0],
            0.33,
            side * (track - 0.14),
        );
        const shockTop = new THREE.Vector3(axles[0] + 0.02, 0.62, side * 0.2);
        quad.add(
            rod(
                shockBottom.toArray() as Point3,
                shockTop.toArray() as Point3,
                0.014,
                m.gloss,
            ),
        );
        quad.add(
            coilSpring(
                shockBottom.clone().lerp(shockTop, 0.1),
                shockBottom.clone().lerp(shockTop, 0.8),
                0.035,
                0.006,
                6,
                m.red,
            ),
        );

        // Rear swingarm legs.
        quad.add(
            rod(
                [-0.2, 0.36, side * 0.16],
                [axles[1], R, side * 0.22],
                0.022,
                m.gloss,
            ),
        );
    }

    quad.add(cyl(0.03, track * 2 - 0.1, m.steel, 'z', axles[1], R, 0));

    // Fenders: moulded shells over each pair of wheels.
    for (const [x, length] of [
        [0.6, 0.8],
        [-0.62, 0.76],
    ] as [number, number][]) {
        quad.add(
            softBox(length, 0.12, 1.1, m.paint, x, 0.64, 0, {
                divisions: [3, 1, 4],
                levels: 3,
                shape: (p) => {
                    const edge = Math.abs(p.z) / 0.55;
                    const end = Math.abs(p.x) / (length / 2);
                    // Wheel humps each side, lower at the ends.
                    p.y += Math.pow(edge, 3) * 0.08 - end * end * 0.08;
                    p.y -= Math.pow(Math.max(0, edge - 0.6) / 0.4, 2) * 0.05;
                },
            }),
        );
    }

    // Headlamps in the front fender, a tail lamp at the back.
    for (const side of [1, -1]) {
        quad.add(
            softBox(0.04, 0.07, 0.14, m.lens, 1.0, 0.64, side * 0.24, {
                crease: 0.6,
            }),
        );
        quad.add(
            softBox(0.02, 0.05, 0.12, m.reflector, 0.985, 0.64, side * 0.24, {
                crease: 0.6,
            }),
        );
    }

    quad.add(
        softBox(0.03, 0.05, 0.12, m.redLens, -1.0, 0.64, 0, { crease: 0.6 }),
    );

    // Racks: tube frames on each fender.
    for (const [x, length] of [
        [0.66, 0.5],
        [-0.66, 0.56],
    ] as [number, number][]) {
        const y = 0.8;
        quad.add(
            bentTube(
                [
                    [x - length / 2, y, 0.38],
                    [x + length / 2, y, 0.38],
                    [x + length / 2, y, -0.38],
                    [x - length / 2, y, -0.38],
                ],
                0.011,
                m.gloss,
                0.05,
                { closed: true },
            ),
        );

        for (let i = 1; i < 4; i++) {
            quad.add(
                rod(
                    [x - length / 2 + (length * i) / 4, y, 0.38],
                    [x - length / 2 + (length * i) / 4, y, -0.38],
                    0.008,
                    m.gloss,
                ),
            );
        }

        for (const z of [0.36, -0.36]) {
            quad.add(rod([x, y, z], [x, 0.7, z * 0.9], 0.009, m.gloss));
        }
    }

    // Tank, seat, handlebar and controls.
    quad.add(
        softBox(0.42, 0.18, 0.32, m.paint, 0.2, 0.8, 0, {
            divisions: [2, 1, 2],
            shape: (p) => {
                p.y += Math.max(0, p.x) * 0.2;
            },
        }),
    );
    quad.add(cyl(0.035, 0.01, m.satin, 'y', 0.22, 0.9, 0));
    quad.add(
        softBox(0.62, 0.11, 0.34, m.seat, -0.3, 0.84, 0, {
            divisions: [3, 1, 2],
            shape: (p) => {
                p.y -= Math.max(0, p.x) * 0.1;
            },
        }),
    );
    quad.add(rod([0.36, 0.78, 0], [0.42, 0.98, 0], 0.022, m.gloss));
    quad.add(
        bentTube(
            [
                [0.34, 1.02, 0.38],
                [0.42, 1.03, 0.18],
                [0.44, 1.0, 0],
                [0.42, 1.03, -0.18],
                [0.34, 1.02, -0.38],
            ],
            0.012,
            m.chrome,
            0.06,
        ),
    );
    quad.add(
        softBox(0.14, 0.1, 0.24, m.plastic, 0.44, 1.0, 0, { crease: 0.6 }),
    );

    for (const side of [1, -1]) {
        quad.add(cyl(0.019, 0.12, m.rubber, 'z', 0.33, 1.02, side * 0.42));
        quad.add(
            rod(
                [0.37, 1.03, side * 0.3],
                [0.4, 1.01, side * 0.45],
                0.006,
                m.gloss,
            ),
        );
    }

    // Exhaust out of the back.
    quad.add(
        tube(
            [
                [0.18, 0.5, 0.12],
                [-0.1, 0.46, 0.25],
                [-0.55, 0.52, 0.27],
                [-0.82, 0.56, 0.27],
            ],
            0.021,
            m.exhaust,
        ),
    );
    quad.add(
        softBox(0.32, 0.1, 0.1, m.stainless, -0.72, 0.55, 0.27, {
            crease: 0.8,
        }),
    );

    quad.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return {
        position: new THREE.Vector3(0.02, 0.5, 0),
        room: new THREE.Vector3(0.4, 0.42, 0.44),
        rotationY: Math.PI / 2,
        exposed: true,
        exhaust: new THREE.Vector3(-0.12, 0, 0.16),
    };
}
