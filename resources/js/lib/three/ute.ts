import * as THREE from 'three';
import { roundPolygon, smoothCurve } from '@/lib/three/curves';
import { UTE_CAB, UTE_SPEC } from '@/lib/three/designs';
import type { Materials } from '@/lib/three/materials';
import {
    buildExhaust,
    buildRoadVehicle,
    type EngineBay,
    type RoadOptions,
    type RoadSpec,
} from '@/lib/three/road';
import {
    bentTube,
    box,
    cyl,
    extrude,
    instanced,
    puck,
    rod,
    torus,
    type Point,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import { buildWheel, tyreRadius } from '@/lib/three/wheels';

/**
 * A dual-cab or single-cab ute: the cab and nose from the body system,
 * then a tub on the back with its own arches, a live rear axle on leaf
 * springs underneath, and the spare hung under the tray.
 */
export function buildUte(
    m: Materials,
    group: THREE.Group,
    options: RoadOptions & { crew: boolean },
): EngineBay {
    const spec = options.crew ? UTE_SPEC : singleCab(UTE_SPEC);
    const bay = buildRoadVehicle(m, spec, group, options);
    const cabRear = spec.design.rear;
    const tubFront = cabRear - 0.06;
    const tubRear = -2.85;
    const floorY = 0.9;
    const railY = 1.245;
    const half = 0.895;
    const [, rearAxle] = spec.axles;
    const wheelRadius = tyreRadius(spec.wheels.tyre);
    const archRadius = spec.archRadius;
    const tub = new THREE.Group();
    group.add(tub);

    // Outer skins: a flat panel in side view with the arch cut out of its
    // bottom edge, extruded to thickness with rounded edges.
    const bottom = 0.52;
    const sideShape: Point[] = [
        [tubFront, railY],
        [tubRear + 0.02, railY],
        [tubRear, railY - 0.03],
        [tubRear, bottom],
    ];
    const archSteps = 24;

    sideShape.push([rearAxle - archRadius, bottom]);

    for (let i = 0; i <= archSteps; i++) {
        const a = Math.PI - (Math.PI * i) / archSteps;
        const y = wheelRadius + Math.sin(a) * archRadius;
        sideShape.push([
            rearAxle + Math.cos(a) * archRadius,
            Math.max(bottom, y),
        ]);
    }

    sideShape.push([tubFront, bottom], [tubFront, railY - 0.03]);

    for (const side of [1, -1] as const) {
        const skin = extrude(polygonShape(sideShape), 0.035, m.paint, {
            bevel: 0.012,
            z: side * (half - 0.0175),
        });
        skin.userData.shell = true;
        tub.add(skin);

        if (side === 1) {
            // The fuel flap ahead of the arch: a painted door in its dark
            // shut line.
            const flap = (width: number, height: number): THREE.Shape =>
                polygonShape(
                    roundPolygon(
                        [
                            [tubFront - 0.28 - width / 2, 1.0 - height / 2],
                            [tubFront - 0.28 + width / 2, 1.0 - height / 2],
                            [tubFront - 0.28 + width / 2, 1.0 + height / 2],
                            [tubFront - 0.28 - width / 2, 1.0 + height / 2],
                        ],
                        0.028,
                        5,
                    ),
                );
            tub.add(
                extrude(flap(0.175, 0.145), 0.003, m.gloss, {
                    bevel: 0,
                    z: half + 0.0012,
                }),
            );
            tub.add(
                extrude(flap(0.165, 0.135), 0.004, m.paint, {
                    bevel: 0.0015,
                    z: half + 0.0025,
                }),
            );
        }

        // A pressed character line along the skin, carrying on the cab's.
        tub.add(
            box(
                tubFront - tubRear - 0.1,
                0.012,
                0.01,
                m.paint,
                (tubFront + tubRear) / 2,
                1.07,
                side * (half + 0.001),
                0.004,
            ),
        );

        // Black plastic flare round the arch.
        const flare = torus(
            archRadius + 0.035,
            0.045,
            m.plastic,
            'z',
            rearAxle,
            wheelRadius,
            side * (half + 0.012),
            {
                arc: Math.PI,
                radial: 10,
                tubular: 40,
            },
        );
        flare.scale.z = 0.6;
        tub.add(flare);

        // Rail caps and the inner wall of the tub.
        tub.add(
            box(
                tubFront - tubRear - 0.02,
                0.028,
                0.11,
                m.plastic,
                (tubFront + tubRear) / 2,
                railY + 0.012,
                side * (half - 0.05),
                0.008,
            ),
        );
        tub.add(
            box(
                tubFront - tubRear - 0.1,
                railY - floorY,
                0.02,
                m.liner,
                (tubFront + tubRear) / 2,
                (railY + floorY) / 2,
                side * (half - 0.09),
                0.006,
            ),
        );

        // Wheel tubs inside.
        tub.add(
            softBox(
                archRadius * 2 + 0.1,
                0.22,
                0.26,
                m.liner,
                rearAxle,
                floorY + 0.1,
                side * (half - 0.2),
                {
                    crease: 0.6,
                },
            ),
        );

        // Tail lamp clusters on the rear corners.
        tub.add(
            softBox(
                0.06,
                0.34,
                0.14,
                m.redLens,
                tubRear - 0.005,
                1.03,
                side * (half - 0.08),
                { crease: 0.8 },
            ),
        );
        tub.add(
            box(
                0.03,
                0.08,
                0.1,
                m.lens,
                tubRear - 0.012,
                0.9,
                side * (half - 0.08),
                0.01,
            ),
        );
    }

    // Headboard, floor with ribs, tailgate.
    tub.add(
        box(
            0.04,
            railY - floorY + 0.02,
            half * 2 - 0.1,
            m.paint,
            tubFront - 0.02,
            (railY + floorY) / 2,
            0,
            0.012,
        ),
    );
    tub.add(
        box(
            tubFront - tubRear - 0.08,
            0.03,
            half * 2 - 0.16,
            m.liner,
            (tubFront + tubRear) / 2,
            floorY,
            0,
            0.01,
        ),
    );
    const rib = new THREE.BoxGeometry(tubFront - tubRear - 0.2, 0.015, 0.05);
    tub.add(
        instanced(
            rib,
            m.liner,
            Array.from({ length: 7 }, (_, i) => ({
                x: (tubFront + tubRear) / 2,
                y: floorY + 0.02,
                z: -0.5 + (i * 1.0) / 6,
            })),
        ),
    );
    const tailgate = softBox(
        0.05,
        railY - 0.6,
        half * 2 - 0.26,
        m.paint,
        tubRear + 0.01,
        (railY + 0.6) / 2,
        0,
        {
            divisions: [1, 2, 3],
            crease: 1.2,
        },
    );
    tailgate.userData.shell = true;
    tub.add(tailgate);
    tub.add(
        box(0.02, 0.05, 0.22, m.gloss, tubRear - 0.018, railY - 0.1, 0, 0.01),
    );

    // Rear step bumper with a tow bar receiver, and the rear plate.
    tub.add(
        box(0.14, 0.13, half * 2 + 0.02, m.gloss, tubRear - 0.04, 0.5, 0, 0.03),
    );
    tub.add(
        box(0.1, 0.03, half * 1.6, m.plastic, tubRear - 0.07, 0.575, 0, 0.01),
    );
    tub.add(box(0.2, 0.07, 0.07, m.steel, tubRear - 0.1, 0.42, 0, 0.01));
    tub.add(cyl(0.025, 0.08, m.chrome, 'z', tubRear - 0.18, 0.42, 0));

    // The chassis rails, a live axle on leaf springs, and a spare wheel.
    const chassis = new THREE.Group();
    tub.add(chassis);

    for (const side of [1, -1]) {
        chassis.add(
            box(3.9, 0.16, 0.06, m.castIron, -0.8, 0.55, side * 0.46, 0.008),
        );

        // Leaf spring pack: stacked leaves, bowed, with shackles.
        for (let leaf = 0; leaf < 4; leaf++) {
            const length = 1.2 - leaf * 0.22;
            const points: [number, number, number][] = [];

            for (let i = 0; i <= 8; i++) {
                const t = i / 8 - 0.5;
                points.push([
                    rearAxle + t * length,
                    wheelRadius + 0.07 - leaf * 0.012 + t * t * 0.18,
                    side * 0.46,
                ]);
            }

            chassis.add(
                bentTube(points, 0.007, m.castIron, 0.05, { radial: 6 }),
            );
        }

        chassis.add(
            rod(
                [rearAxle + 0.6, wheelRadius + 0.13, side * 0.46],
                [rearAxle + 0.62, 0.52, side * 0.46],
                0.02,
                m.castIron,
            ),
        );
        chassis.add(
            rod(
                [rearAxle - 0.6, wheelRadius + 0.13, side * 0.46],
                [rearAxle - 0.66, 0.5, side * 0.46],
                0.02,
                m.castIron,
            ),
        );
        chassis.add(
            box(
                0.1,
                0.05,
                0.08,
                m.steel,
                rearAxle,
                wheelRadius + 0.02,
                side * 0.46,
                0.01,
            ),
        );

        // Shock absorber.
        chassis.add(
            rod(
                [rearAxle - 0.12, wheelRadius, side * 0.52],
                [rearAxle - 0.2, 0.62, side * 0.5],
                0.028,
                m.gloss,
            ),
        );
    }

    chassis.add(cyl(0.045, 1.55, m.castIron, 'z', rearAxle, wheelRadius, 0));
    chassis.add(puck(0.15, 0.2, m.castIron, 'z', rearAxle, wheelRadius, 0.04));
    chassis.add(
        cyl(
            0.035,
            1.3,
            m.steel,
            'x',
            rearAxle + 0.75,
            wheelRadius + 0.03,
            0.04,
        ),
    );

    const spare = buildWheel(m, { ...spec.wheels, brake: 'none' }, 1);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(-2.3, 0.46, 0);
    spare.scale.setScalar(0.98);
    chassis.add(spare);

    buildExhaust(m, { y: 0.44, z: 0.62 }, tubRear + 0.3, spec.axles, 0.5, tub);

    tub.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    return bay;
}

function polygonShape(points: Point[]): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);

    for (const [x, y] of points.slice(1)) {
        shape.lineTo(x, y);
    }

    shape.closePath();

    return shape;
}

/**
 * The single-cab version: the cab ends just behind the doors and the tub
 * is longer.
 */
function singleCab(spec: RoadSpec): RoadSpec {
    const rear = 0.36;
    const cut = (line: [number, number][]): [number, number][] => [
        ...line.filter(([x]) => x > rear + 0.05),
        [rear, smoothCurve(line)(rear)],
    ];

    return {
        ...spec,
        design: {
            ...UTE_CAB,
            rear,
            rocker: cut(UTE_CAB.rocker),
            shoulder: cut(UTE_CAB.shoulder),
            belt: cut(UTE_CAB.belt),
            roof: [
                ...UTE_CAB.roof.filter(([x]) => x > 0.45),
                [0.4, 1.78],
                [rear, 1.73],
            ],
            glassTop: [
                [1.1, 1.6],
                [0.3, 1.68],
            ],
            width: cut(UTE_CAB.width),
            glassWidth: [
                [1.1, 0.84],
                [0.4, 0.8],
            ],
            rearHeader: rear,
            deck: rear,
        },
        glass: { rear: [0.47, 0.49] },
        doorLines: [
            [1.22, 1.12],
            [0.47, 0.47],
        ],
        handles: [0.58],
        seats: { rows: [0.62], bench: true },
    };
}
