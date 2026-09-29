import * as THREE from 'three';
import type { BodyDesign } from '@/lib/three/body-shell';
import type { Materials } from '@/lib/three/materials';
import {
    buildRoadVehicle,
    type EngineBay,
    type RoadOptions,
    type RoadSpec,
} from '@/lib/three/road';
import {
    bentTube,
    box,
    cyl,
    instanced,
    puck,
    rod,
    torus,
    tube,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import { buildWheel, tyreRadius, type TyreSpec } from '@/lib/three/wheels';

const TRUCK_TYRE: TyreSpec = {
    width: 0.225,
    aspect: 0.75,
    rim: 17.5,
    tread: 'truck',
    label: 'TUBELESS  LT',
};

/**
 * A light-medium cab-over truck's cab: flat front, near vertical screen,
 * deep side windows, sitting high on the chassis.
 */
const TRUCK_CAB: BodyDesign = {
    front: 3.3,
    rear: 1.48,
    rocker: [
        [3.3, 0.98],
        [1.48, 0.98],
    ],
    shoulder: [
        [3.3, 1.42],
        [1.48, 1.46],
    ],
    belt: [
        [3.3, 1.7],
        [3.2, 1.73],
        [1.48, 1.75],
    ],
    roof: [
        [3.3, 1.71],
        [3.25, 1.735],
        [3.12, 2.4],
        [2.95, 2.47],
        [1.62, 2.47],
        [1.48, 2.44],
    ],
    glassTop: [
        [3.25, 2.3],
        [1.48, 2.3],
    ],
    width: [
        [3.3, 1.02],
        [3.05, 1.05],
        [1.48, 1.05],
    ],
    glassWidth: [
        [3.25, 0.99],
        [1.48, 0.99],
    ],
    cowl: 3.25,
    header: 3.12,
    rearHeader: 1.48,
    deck: 1.48,
    tuck: 0.02,
    beltInset: 0.012,
    cornerFront: 0.16,
    cornerRear: 0.06,
    frontBow: 0.035,
    rearBow: 0.004,
    frontBowHeight: 0.5,
    rearBowHeight: 0.5,
    shoulderCrease: 1,
    levels: 2,
};

const TRUCK_SPEC: RoadSpec = {
    design: TRUCK_CAB,
    axles: [2.25, -1.6],
    track: 0.86,
    wheels: { tyre: TRUCK_TYRE, rim: 'truck', brake: 'drum', studs: 6 },
    archRadius: 0.5,
    glass: { rear: [1.66, 1.7] },
    doorLines: [
        [3.02, 3.0],
        [1.7, 1.7],
    ],
    handles: [1.86],
    mirror: 3.08,
    mirrorStyle: 'truck',
    headlamp: [
        [0.62, 1.0],
        [0.98, 1.0],
        [0.99, 1.16],
        [0.62, 1.16],
    ],
    grille: [
        [0, 1.2],
        [0.62, 1.2],
        [0.66, 1.25],
        [0.64, 1.6],
        [0, 1.62],
    ],
    taillamp: [],
    plate: { front: -1, rear: -1 },
    bonnetRear: 9,
    boot: 'none',
    seats: { rows: [2.2], bench: true },
    liners: false,
    wheelAxles: [2.25],
    bay: {
        position: new THREE.Vector3(2.25, 1.0, 0),
        room: new THREE.Vector3(1.1, 0.8, 0.8),
        rotationY: 0,
    },
};

/**
 * A cab-over rigid truck: the cab on a ladder chassis, a dry freight box
 * on the back with its corner posts and roller door, steel bumper and
 * steps, fuel and air tanks, and duals at the back.
 */
export function buildTruck(
    m: Materials,
    group: THREE.Group,
    options: RoadOptions,
): EngineBay {
    const spec = TRUCK_SPEC;
    const bay = buildRoadVehicle(m, spec, group, { ...options, levels: 2 });
    const [front, rear] = spec.axles;
    const radius = tyreRadius(TRUCK_TYRE);
    const width = 1.05;
    const extras = new THREE.Group();
    group.add(extras);

    // Ladder chassis.
    for (const side of [1, -1]) {
        extras.add(
            box(7.1, 0.22, 0.07, m.castIron, -0.2, 0.72, side * 0.43, 0.006),
        );
    }

    for (const x of [3.1, 2.0, 0.6, -0.8, -2.2, -3.5]) {
        extras.add(box(0.07, 0.18, 0.86, m.castIron, x, 0.72, 0, 0.006));
    }

    // Steel bumper with lamps and plate, and steps under the doors.
    extras.add(
        softBox(0.22, 0.3, width * 2 + 0.02, m.gloss, 3.3, 0.8, 0, {
            crease: 1,
            divisions: [1, 1, 4],
        }),
    );
    extras.add(box(0.06, 0.12, 0.5, m.plate, 3.42, 0.8, 0, 0.006));
    extras.userData.plate = true;

    for (const side of [1, -1]) {
        extras.add(box(0.05, 0.08, 0.2, m.lens, 3.41, 0.84, side * 0.8, 0.01));
        extras.add(
            box(0.05, 0.05, 0.12, m.amberLens, 3.41, 0.72, side * 0.85, 0.01),
        );

        for (const y of [0.56, 0.8]) {
            extras.add(
                box(
                    0.36,
                    0.04,
                    0.2,
                    m.steel,
                    2.95,
                    y,
                    side * (width - 0.02),
                    0.01,
                ),
            );
        }

        extras.add(
            box(
                0.36,
                0.5,
                0.03,
                m.gloss,
                2.95,
                0.72,
                side * (width - 0.09),
                0.01,
            ),
        );

        // Front guards over the wheels, hung from the cab.
        const guard = torus(
            radius + 0.08,
            0.05,
            m.plastic,
            'z',
            front,
            radius,
            side * (width - 0.12),
            {
                arc: Math.PI * 0.9,
                start: Math.PI * 0.05,
                radial: 8,
                tubular: 32,
            },
        );
        guard.scale.z = 2.6;
        extras.add(guard);
    }

    // Diesel tank, battery box, air tanks and the exhaust stack.
    extras.add(
        softBox(1.1, 0.5, 0.5, m.satin, 0.9, 0.62, 0.72, {
            crease: 1.2,
            divisions: [3, 2, 2],
        }),
    );
    extras.add(cyl(0.05, 0.08, m.gloss, 'y', 0.6, 0.9, 0.72));

    for (const x of [0.55, 1.15]) {
        extras.add(box(0.04, 0.5, 0.52, m.gloss, x, 0.62, 0.72, 0.005));
    }

    extras.add(box(0.6, 0.45, 0.45, m.plastic, 0.9, 0.62, -0.72, 0.02));
    extras.add(cyl(0.13, 0.7, m.satin, 'x', -0.4, 0.55, -0.7));
    extras.add(cyl(0.13, 0.7, m.satin, 'x', -0.4, 0.55, 0.7));
    extras.add(cyl(0.16, 0.55, m.stainless, 'x', 1.9, 0.5, -0.55));
    extras.add(
        tube(
            [
                [2.2, 0.5, -0.55],
                [1.55, 0.5, -0.55],
                [1.4, 0.55, -0.78],
                [1.38, 1.6, -0.9],
                [1.38, 2.7, -0.9],
            ],
            0.055,
            m.stainless,
        ),
    );
    extras.add(cyl(0.07, 0.8, m.gloss, 'y', 1.38, 2.3, -0.9, { open: true }));

    // The freight box: floor, walls, roof, corner posts, roller door.
    const boxFront = 1.34;
    const boxRear = -3.75;
    const boxLength = boxFront - boxRear;
    const boxX = (boxFront + boxRear) / 2;
    const floor = 1.08;
    const top = 3.25;
    const half = 1.24;
    const panels = new THREE.Group();
    panels.add(
        box(boxLength, 0.12, half * 2, m.castIron, boxX, floor - 0.06, 0, 0.01),
    );

    for (const side of [1, -1]) {
        panels.add(
            box(
                boxLength - 0.1,
                top - floor - 0.1,
                0.02,
                m.panel,
                boxX,
                (top + floor) / 2,
                side * half,
                0.004,
            ),
        );
        // Rivet lines and vertical ribs.
        const rib = new THREE.BoxGeometry(0.03, top - floor - 0.14, 0.012);
        panels.add(
            instanced(
                rib,
                m.stainless,
                Array.from({ length: 12 }, (_, i) => ({
                    x: boxFront - 0.2 - i * ((boxLength - 0.4) / 11),
                    y: (top + floor) / 2,
                    z: side * (half + 0.012),
                })),
            ),
        );
        panels.add(
            box(
                boxLength,
                0.09,
                0.05,
                m.stainless,
                boxX,
                top - 0.03,
                side * (half + 0.015),
                0.006,
            ),
        );
        panels.add(
            box(
                boxLength,
                0.12,
                0.05,
                m.stainless,
                boxX,
                floor + 0.04,
                side * (half + 0.015),
                0.006,
            ),
        );

        for (const x of [boxFront, boxRear]) {
            panels.add(
                box(
                    0.07,
                    top - floor,
                    0.07,
                    m.stainless,
                    x,
                    (top + floor) / 2,
                    side * (half - 0.01),
                    0.008,
                ),
            );
        }

        // Side under-run rail and marker lamps.
        panels.add(
            box(
                3.2,
                0.06,
                0.04,
                m.steel,
                -0.9,
                0.62,
                side * (half - 0.04),
                0.01,
            ),
        );

        for (let i = 0; i < 4; i++) {
            panels.add(
                box(
                    0.06,
                    0.03,
                    0.02,
                    m.amberLens,
                    boxFront - 0.6 - i * 1.3,
                    floor + 0.12,
                    side * (half + 0.03),
                    0.005,
                ),
            );
        }
    }

    panels.add(box(boxLength, 0.03, half * 2, m.panel, boxX, top, 0, 0.004));
    panels.add(
        box(
            0.03,
            top - floor,
            half * 2,
            m.panel,
            boxFront,
            (top + floor) / 2,
            0,
            0.004,
        ),
    );

    // Roller door: horizontal slats behind the rear frame.
    const slat = new THREE.BoxGeometry(0.025, 0.1, half * 2 - 0.16);
    panels.add(
        instanced(
            slat,
            m.panel,
            Array.from({ length: 20 }, (_, i) => ({
                x: boxRear - 0.005,
                y: floor + 0.07 + i * 0.104,
                z: 0,
                rz: 0.04,
            })),
        ),
    );
    panels.add(
        box(
            0.06,
            0.08,
            half * 2,
            m.stainless,
            boxRear - 0.02,
            top - 0.05,
            0,
            0.008,
        ),
    );
    panels.add(
        box(0.05, 0.05, 0.3, m.gloss, boxRear - 0.03, floor + 0.12, 0, 0.01),
    );
    extras.add(panels);

    // Rear lamps, plate and under-run bar on the chassis end.
    extras.add(box(0.1, 0.1, 2.3, m.gloss, boxRear - 0.05, 0.5, 0, 0.02));

    for (const side of [1, -1]) {
        extras.add(
            box(
                0.03,
                0.12,
                0.34,
                m.redLens,
                boxRear - 0.1,
                0.68,
                side * 0.86,
                0.01,
            ),
        );
        extras.add(
            box(
                0.03,
                0.06,
                0.1,
                m.amberLens,
                boxRear - 0.1,
                0.68,
                side * 0.6,
                0.01,
            ),
        );

        // Rear guards over the duals.
        extras.add(
            box(
                0.9,
                0.02,
                0.62,
                m.plastic,
                rear,
                radius * 2 + 0.1,
                side * 0.86,
                0.006,
            ),
        );
        extras.add(
            box(
                0.02,
                0.5,
                0.6,
                m.rubber,
                rear - 0.5,
                radius + 0.15,
                side * 0.86,
                0.004,
            ),
        );
    }

    extras.add(box(0.03, 0.14, 0.52, m.plate, boxRear - 0.11, 0.84, 0, 0.004));

    // The rear axle: duals, differential, springs.
    for (const side of [1, -1] as const) {
        const wheel = buildWheel(m, { ...spec.wheels, dual: true }, side);
        wheel.position.set(rear, radius, side * 0.94);
        extras.add(wheel);

        for (let leaf = 0; leaf < 5; leaf++) {
            const length = 1.4 - leaf * 0.2;
            const points: [number, number, number][] = [];

            for (let i = 0; i <= 8; i++) {
                const t = i / 8 - 0.5;
                points.push([
                    rear + t * length,
                    radius + 0.1 - leaf * 0.015 + t * t * 0.2,
                    side * 0.43,
                ]);
            }

            extras.add(bentTube(points, 0.01, m.castIron, 0.05, { radial: 6 }));
        }
    }

    extras.add(cyl(0.06, 1.7, m.castIron, 'z', rear, radius, 0));
    extras.add(puck(0.2, 0.26, m.castIron, 'z', rear, radius, 0.05));
    extras.add(
        cyl(
            0.045,
            3.4,
            m.steel,
            'x',
            (front + rear) / 2 - 0.3,
            radius + 0.1,
            0.05,
        ),
    );
    extras.add(cyl(0.05, 1.7, m.castIron, 'z', front, radius, 0));
    extras.add(
        rod([front, radius, 0.43], [front - 0.4, 0.62, 0.43], 0.03, m.castIron),
    );
    extras.add(
        rod(
            [front, radius, -0.43],
            [front - 0.4, 0.62, -0.43],
            0.03,
            m.castIron,
        ),
    );

    extras.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return bay;
}

const BUS_TYRE: TyreSpec = {
    width: 0.245,
    aspect: 0.7,
    rim: 19.5,
    tread: 'truck',
    label: 'TUBELESS',
};

/**
 * A 9 m midi bus: boxy with softened corners, a deep windscreen, windows
 * the whole way down, a door at the front on the kerb side.
 */
const BUS_BODY: BodyDesign = {
    front: 4.45,
    rear: -4.45,
    rocker: [
        [4.45, 0.42],
        [3.3, 0.36],
        [0, 0.34],
        [-3.3, 0.36],
        [-4.45, 0.46],
    ],
    shoulder: [
        [4.45, 1.0],
        [0, 1.05],
        [-4.45, 1.05],
    ],
    belt: [
        [4.45, 1.1],
        [4.3, 1.2],
        [0, 1.26],
        [-4.45, 1.26],
    ],
    roof: [
        [4.45, 1.12],
        [4.4, 1.16],
        [4.2, 2.55],
        [4.05, 2.88],
        [3.6, 2.95],
        [-4.1, 2.95],
        [-4.35, 2.9],
        [-4.45, 2.8],
    ],
    glassTop: [
        [4.4, 2.48],
        [0, 2.5],
        [-4.4, 2.5],
    ],
    width: [
        [4.45, 1.18],
        [4.0, 1.24],
        [-4.45, 1.24],
    ],
    glassWidth: [
        [4.4, 1.2],
        [-4.4, 1.2],
    ],
    cowl: 4.4,
    header: 4.18,
    rearHeader: -4.45,
    deck: -4.45,
    tuck: 0.025,
    beltInset: 0.012,
    cornerFront: 0.26,
    cornerRear: 0.22,
    frontBow: 0.04,
    rearBow: 0.02,
    frontBowHeight: 0.5,
    rearBowHeight: 0.5,
    shoulderCrease: 0.8,
    levels: 2,
};

function busSpec(): RoadSpec {
    const pillars: [number, number][] = [];

    for (let i = 0; i < 7; i++) {
        const x = 3.05 - i * 1.12;
        pillars.push([x + 0.04, x - 0.04]);
    }

    return {
        design: BUS_BODY,
        axles: [3.0, -2.25],
        track: 1.0,
        wheels: { tyre: BUS_TYRE, rim: 'truck', brake: 'drum', studs: 8 },
        archRadius: 0.52,
        glass: { rear: [-4.2, -4.2], pillars: [[4.02, 3.95], ...pillars] },
        doorLines: [[3.95, 3.95]],
        handles: [],
        mirror: 4.3,
        mirrorStyle: 'bus',
        headlamp: [
            [0.68, 0.62],
            [1.1, 0.62],
            [1.12, 0.8],
            [0.68, 0.8],
        ],
        grille: [
            [0, 0.6],
            [0.5, 0.6],
            [0.5, 0.95],
            [0, 0.95],
        ],
        taillamp: [
            [0.95, 0.6],
            [1.18, 0.6],
            [1.19, 1.3],
            [0.95, 1.3],
        ],
        tailgateGlass: [
            [0, 1.6],
            [0.95, 1.6],
            [0.95, 2.5],
            [0, 2.5],
        ],
        plate: { front: 0.48, rear: 0.55 },
        bonnetRear: 9,
        boot: 'none',
        exhaust: { y: 0.4, z: -0.8 },
        seats: {
            rows: [3.9, 2.8, 2.0, 1.2, 0.4, -0.4, -1.2, -2.0, -2.8, -3.6],
            bench: false,
        },
        bay: {
            position: new THREE.Vector3(-3.65, 0.9, 0),
            room: new THREE.Vector3(1.0, 0.9, 1.1),
            rotationY: Math.PI / 2,
        },
        liners: true,
    };
}

export function buildBus(
    m: Materials,
    group: THREE.Group,
    options: RoadOptions,
): EngineBay {
    const rightHandDrive = options.rightHandDrive ?? false;
    const spec = busSpec();
    const bay = buildRoadVehicle(m, spec, group, { ...options, levels: 2 });
    const extras = new THREE.Group();
    group.add(extras);

    // The door on the kerb side: glass panels in a black frame.
    const kerb = rightHandDrive ? -1 : 1;
    const doorX = 3.55;

    for (const dz of [-0.24, 0.24]) {
        extras.add(
            box(
                0.46,
                1.95,
                0.02,
                m.glass,
                doorX + dz,
                1.36,
                kerb * 1.245,
                0.01,
            ),
        );
        extras.add(
            box(
                0.5,
                2.0,
                0.015,
                m.gloss,
                doorX + dz,
                1.36,
                kerb * 1.238,
                0.006,
            ),
        );
    }

    // Destination sign above the screen, roof air conditioning pod.
    extras.add(box(0.05, 0.22, 1.7, m.gloss, 4.18, 2.72, 0, 0.01));
    const sign = new THREE.MeshStandardMaterial({
        color: 0x1a0d00,
        emissive: 0xff9a1a,
        emissiveIntensity: 1.1,
        roughness: 0.6,
    });
    extras.add(box(0.01, 0.12, 1.4, sign, 4.21, 2.72, 0, 0.002));
    extras.add(
        softBox(2.2, 0.28, 1.7, m.paint, 0.6, 3.08, 0, {
            crease: 0.8,
            divisions: [3, 1, 3],
        }),
    );
    extras.add(
        instanced(
            new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24),
            m.gloss,
            [-0.2, 0.6, 1.4].map((x) => ({ x, y: 3.23, z: 0 })),
        ),
    );

    // Rear engine grille.
    extras.add(
        instanced(
            new THREE.BoxGeometry(0.02, 0.02, 1.6),
            m.gloss,
            Array.from({ length: 8 }, (_, i) => ({
                x: -4.47,
                y: 0.75 + i * 0.07,
                z: 0,
            })),
        ),
    );

    extras.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return bay;
}
