import * as THREE from 'three';
import { coilSpring } from '@/lib/three/bike';
import type { Materials } from '@/lib/three/materials';
import type { EngineBay } from '@/lib/three/road';
import {
    bentTube,
    box,
    cyl,
    instanced,
    puck,
    rod,
    torus,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import { buildWheel, tyreRadius, type TyreSpec } from '@/lib/three/wheels';

/**
 * The colour a maker would paint the wheel centres to go with the body:
 * yellow on green, cream on red, grey on anything else.
 */
function rimColour(m: Materials): THREE.MeshPhysicalMaterial {
    const hsl = { h: 0, s: 0, l: 0 };
    m.paint.color.getHSL(hsl);
    const hue = hsl.h * 360;
    const colour =
        hsl.s < 0.2
            ? 0x9aa0a6
            : hue > 70 && hue < 170
              ? 0xe2b21c
              : hue < 20 || hue > 330
                ? 0xd8d2c0
                : 0x9aa0a6;

    return new THREE.MeshPhysicalMaterial({
        color: colour,
        metalness: 0.2,
        roughness: 0.38,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
    });
}

/**
 * A 100 hp four-wheel-drive utility tractor with a cab: 18.4R34 rears,
 * a sloping bonnet over the engine, suitcase weights on the nose, a glass
 * cab with its exhaust stack and pre-cleaner, and a three-point hitch.
 */
export function buildTractor(m: Materials, group: THREE.Group): EngineBay {
    const tractor = new THREE.Group();
    group.add(tractor);
    const rearTyre: TyreSpec = {
        width: 0.467,
        aspect: 0.85,
        rim: 34,
        tread: 'tractor',
        label: '18.4R34  R-1W',
    };
    const frontTyre: TyreSpec = {
        width: 0.378,
        aspect: 0.85,
        rim: 24,
        tread: 'tractor',
        label: '14.9R24  R-1W',
    };
    const Rr = tyreRadius(rearTyre);
    const Rf = tyreRadius(frontTyre);
    const rearX = -0.85;
    const frontX = 1.45;
    const rims = rimColour(m);

    for (const side of [1, -1] as const) {
        const rear = buildWheel(
            m,
            {
                tyre: rearTyre,
                rim: 'tractor',
                brake: 'none',
                studs: 8,
                rimMaterial: rims,
            },
            side,
        );
        rear.position.set(rearX, Rr, side * 0.88);
        tractor.add(rear);
        const front = buildWheel(
            m,
            {
                tyre: frontTyre,
                rim: 'tractor',
                brake: 'none',
                studs: 8,
                rimMaterial: rims,
            },
            side,
        );
        front.position.set(frontX, Rf, side * 0.84);
        front.rotation.y = 0.12;
        tractor.add(front);
    }

    // Rear axle housings, transmission case and the front axle beam.
    tractor.add(
        softBox(0.9, 0.62, 0.72, m.castIron, rearX + 0.05, Rr + 0.05, 0, {
            crease: 1,
            divisions: [2, 2, 2],
        }),
    );

    for (const side of [1, -1]) {
        tractor.add(
            cyl(0.11, 0.5, m.castIron, 'z', rearX, Rr, side * 0.55, {
                top: 0.08,
            }),
        );
    }

    tractor.add(box(1.6, 0.42, 0.56, m.castIron, 0.2, Rr + 0.02, 0, 0.04));
    tractor.add(cyl(0.08, 1.45, m.castIron, 'z', frontX, Rf, 0));
    tractor.add(puck(0.16, 0.24, m.castIron, 'z', frontX, Rf, 0));

    for (const side of [1, -1]) {
        tractor.add(
            rod(
                [frontX - 0.1, Rf + 0.05, side * 0.3],
                [frontX + 0.05, Rf + 0.08, side * 0.72],
                0.025,
                m.steel,
            ),
        );
        tractor.add(
            puck(0.11, 0.14, m.castIron, 'y', frontX, Rf + 0.02, side * 0.72),
        );
    }

    // Bonnet: a long soft shell that slopes to the nose, grille and lamps.
    const bonnet = softBox(2.1, 0.62, 0.84, m.paint, 1.25, 1.24, 0, {
        divisions: [4, 2, 2],
        levels: 3,
        crease: 0.6,
        shape: (p) => {
            const t = (p.x + 1.05) / 2.1;
            p.y -= t * t * 0.14 * (p.y > 0 ? 1 : 0.2);
            p.z *= 1 - t * 0.12;
            // Rounded shoulders along the top.
            p.z *= 1 - Math.max(0, p.y - 0.2) * 0.6;
        },
    });
    tractor.add(bonnet);
    const grille = box(0.04, 0.44, 0.58, m.gloss, 2.3, 1.12, 0, 0.02);
    tractor.add(grille);
    tractor.add(
        instanced(
            new THREE.BoxGeometry(0.02, 0.015, 0.54),
            m.chrome,
            Array.from({ length: 9 }, (_, i) => ({
                x: 2.32,
                y: 0.94 + i * 0.045,
                z: 0,
            })),
        ),
    );

    for (const side of [1, -1]) {
        tractor.add(
            softBox(0.05, 0.09, 0.18, m.lens, 2.27, 1.42, side * 0.26, {
                crease: 0.6,
            }),
        );
        tractor.add(
            softBox(0.02, 0.07, 0.15, m.reflector, 2.25, 1.42, side * 0.26, {
                crease: 0.6,
            }),
        );
        // Side louvres.
        tractor.add(
            instanced(
                new THREE.BoxGeometry(0.6, 0.012, 0.01),
                m.gloss,
                Array.from({ length: 6 }, (_, i) => ({
                    x: 1.35,
                    y: 1.02 + i * 0.05,
                    z: side * 0.41,
                })),
            ),
        );
    }

    // Front weight bracket with suitcase weights.
    tractor.add(box(0.2, 0.3, 0.8, m.castIron, 2.45, 0.86, 0, 0.02));
    tractor.add(
        instanced(
            new THREE.BoxGeometry(0.06, 0.38, 0.62),
            m.gloss,
            Array.from({ length: 8 }, (_, i) => ({
                x: 2.58 + i * 0.065,
                y: 0.88,
                z: 0,
            })),
        ),
    );
    tractor.add(
        bentTube(
            [
                [2.55, 1.08, 0.2],
                [2.55, 1.14, 0.2],
                [2.55, 1.14, -0.2],
                [2.55, 1.08, -0.2],
            ],
            0.018,
            m.gloss,
            0.04,
        ),
    );

    // The cab: floor, four posts, glass all round, a roof with lamps.
    const cabFront = 0.25;
    const cabRear = -1.35;
    const floor = 1.12;
    const roofY = 2.72;
    const half = 0.62;
    tractor.add(
        box(
            cabFront - cabRear,
            0.08,
            half * 2,
            m.gloss,
            (cabFront + cabRear) / 2,
            floor,
            0,
            0.01,
        ),
    );

    for (const x of [cabFront - 0.04, cabRear + 0.04]) {
        for (const side of [1, -1]) {
            tractor.add(
                bentTube(
                    [
                        [x, floor, side * (half - 0.03)],
                        [x, roofY - 0.06, side * (half - 0.02)],
                    ],
                    0.03,
                    m.gloss,
                    0.02,
                ),
            );
        }
    }

    const glassHeight = roofY - floor - 0.16;
    const glassY = floor + 0.06 + glassHeight / 2;
    tractor.add(
        box(
            0.012,
            glassHeight,
            half * 2 - 0.1,
            m.glass,
            cabFront - 0.02,
            glassY,
            0,
            0.004,
        ),
    );
    tractor.add(
        box(
            0.012,
            glassHeight,
            half * 2 - 0.1,
            m.glass,
            cabRear + 0.02,
            glassY,
            0,
            0.004,
        ),
    );

    for (const side of [1, -1]) {
        tractor.add(
            box(
                cabFront - cabRear - 0.1,
                glassHeight,
                0.012,
                m.glass,
                (cabFront + cabRear) / 2,
                glassY,
                side * (half - 0.01),
                0.004,
            ),
        );
        tractor.add(
            box(
                0.02,
                glassHeight - 0.2,
                0.02,
                m.gloss,
                -0.45,
                glassY,
                side * (half + 0.004),
                0.004,
            ),
        );
        tractor.add(
            bentTube(
                [
                    [-0.3, glassY - 0.3, side * (half + 0.03)],
                    [-0.3, glassY + 0.3, side * (half + 0.03)],
                ],
                0.01,
                m.chrome,
                0.02,
            ),
        );
    }

    tractor.add(
        softBox(
            cabFront - cabRear + 0.3,
            0.14,
            half * 2 + 0.16,
            m.paint,
            (cabFront + cabRear) / 2,
            roofY,
            0,
            {
                divisions: [3, 1, 3],
                crease: 0.8,
                shape: (p) => {
                    p.y +=
                        Math.cos((p.z / (half + 0.08)) * (Math.PI / 2)) * 0.03;
                },
            },
        ),
    );

    for (const side of [1, -1]) {
        tractor.add(
            softBox(
                0.08,
                0.07,
                0.14,
                m.lens,
                cabFront + 0.12,
                roofY - 0.02,
                side * 0.4,
                { crease: 0.6 },
            ),
        );
        tractor.add(
            softBox(
                0.08,
                0.07,
                0.14,
                m.lens,
                cabRear - 0.12,
                roofY - 0.02,
                side * 0.4,
                { crease: 0.6 },
            ),
        );
        // Long mirror arms.
        tractor.add(
            bentTube(
                [
                    [cabFront - 0.04, 2.3, side * half],
                    [cabFront + 0.05, 2.35, side * (half + 0.35)],
                ],
                0.012,
                m.gloss,
                0.03,
            ),
        );
        tractor.add(
            softBox(
                0.04,
                0.26,
                0.18,
                m.gloss,
                cabFront + 0.06,
                2.3,
                side * (half + 0.4),
                { crease: 0.6 },
            ),
        );
    }

    // Seat, wheel and console seen through the glass.
    tractor.add(
        softBox(0.46, 0.12, 0.48, m.seat, -0.72, floor + 0.46, 0, {
            crease: 0.4,
        }),
    );
    tractor.add(
        softBox(0.12, 0.6, 0.48, m.seat, -0.98, floor + 0.78, 0, {
            crease: 0.4,
        }),
    );
    tractor.add(
        rod([0.02, floor + 0.1, 0], [-0.15, floor + 0.85, 0], 0.03, m.gloss),
    );
    const wheel = torus(0.2, 0.018, m.gloss, 'y', -0.18, floor + 0.88, 0, {
        radial: 10,
        tubular: 40,
    });
    wheel.rotation.z = 0.35;
    tractor.add(wheel);
    tractor.add(
        softBox(0.5, 0.35, 0.16, m.dash, -0.6, floor + 0.3, 0.42, {
            crease: 0.4,
        }),
    );

    // Rear mudguards arcing over the big wheels.
    for (const side of [1, -1]) {
        const guard = torus(
            Rr + 0.08,
            0.06,
            m.paint,
            'z',
            rearX,
            Rr,
            side * 0.92,
            {
                arc: Math.PI * 0.62,
                start: Math.PI * 0.2,
                radial: 10,
                tubular: 40,
            },
        );
        guard.scale.z = 4.6;
        tractor.add(guard);
        tractor.add(
            softBox(
                0.1,
                0.06,
                0.16,
                m.amberLens,
                rearX + 0.35,
                2.02,
                side * 1.05,
                { crease: 0.5 },
            ),
        );
        tractor.add(
            softBox(
                0.08,
                0.08,
                0.12,
                m.redLens,
                rearX - 0.5,
                1.8,
                side * 1.05,
                { crease: 0.5 },
            ),
        );
    }

    // Steps up to the cab on the left, and the fuel tank.
    for (let i = 0; i < 3; i++) {
        tractor.add(
            box(0.36, 0.03, 0.2, m.steel, -0.35, 0.45 + i * 0.26, -0.78, 0.008),
        );
    }

    tractor.add(
        bentTube(
            [
                [-0.53, 0.45, -0.8],
                [-0.53, 1.15, -0.8],
            ],
            0.015,
            m.gloss,
            0.02,
        ),
    );
    tractor.add(
        bentTube(
            [
                [-0.17, 0.45, -0.8],
                [-0.17, 1.15, -0.8],
            ],
            0.015,
            m.gloss,
            0.02,
        ),
    );
    tractor.add(
        softBox(0.6, 0.4, 0.34, m.gloss, -0.35, 0.8, 0.55, { crease: 0.8 }),
    );

    // Exhaust stack and air pre-cleaner at the front corners of the cab.
    tractor.add(
        bentTube(
            [
                [0.55, 1.25, 0.34],
                [0.4, 1.35, 0.4],
                [0.35, 1.6, 0.44],
                [0.35, 2.85, 0.44],
                [0.25, 2.95, 0.44],
            ],
            0.045,
            m.gloss,
            0.12,
        ),
    );
    tractor.add(cyl(0.065, 0.5, m.stainless, 'y', 0.35, 2.3, 0.44));
    tractor.add(cyl(0.1, 0.24, m.gloss, 'y', 0.35, 1.9, -0.44));
    tractor.add(cyl(0.12, 0.08, m.gloss, 'y', 0.35, 2.06, -0.44));

    // Three-point hitch: lift arms, lower links, top link, PTO and drawbar.
    const hitchX = rearX - 0.55;

    for (const side of [1, -1]) {
        tractor.add(
            rod(
                [rearX - 0.15, Rr - 0.15, side * 0.3],
                [hitchX - 0.35, 0.55, side * 0.42],
                0.025,
                m.castIron,
            ),
        );
        tractor.add(
            rod(
                [rearX - 0.1, Rr + 0.35, side * 0.25],
                [hitchX - 0.1, Rr + 0.25, side * 0.3],
                0.022,
                m.castIron,
            ),
        );
        tractor.add(
            rod(
                [hitchX - 0.1, Rr + 0.25, side * 0.3],
                [hitchX - 0.25, 0.62, side * 0.4],
                0.016,
                m.steel,
            ),
        );
        tractor.add(
            puck(0.04, 0.06, m.yellow, 'z', hitchX - 0.36, 0.55, side * 0.45),
        );
    }

    tractor.add(
        rod(
            [rearX - 0.35, Rr + 0.3, 0],
            [hitchX - 0.3, Rr + 0.15, 0],
            0.028,
            m.castIron,
        ),
    );
    tractor.add(cyl(0.028, 0.14, m.steel, 'x', rearX - 0.48, Rr - 0.1, 0));
    tractor.add(box(0.5, 0.04, 0.12, m.castIron, rearX - 0.55, 0.45, 0, 0.01));

    tractor.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return {
        position: new THREE.Vector3(1.25, 1.08, 0),
        room: new THREE.Vector3(1.3, 0.72, 0.6),
        rotationY: 0,
    };
}

/**
 * A ride-on lawn tractor: a 42 inch deck slung between the axles with its
 * chute, a hood over a V-twin, turf tyres, a high-back seat on the rear
 * fender pan.
 */
export function buildMower(m: Materials, group: THREE.Group): EngineBay {
    const mower = new THREE.Group();
    group.add(mower);
    const rearTyre: TyreSpec = {
        width: 0.254,
        aspect: 0.5,
        rim: 8,
        tread: 'turf',
        label: '20X10.00-8',
    };
    const frontTyre: TyreSpec = {
        width: 0.152,
        aspect: 0.75,
        rim: 6,
        tread: 'turf',
        label: '15X6.00-6',
    };
    const Rr = tyreRadius(rearTyre);
    const Rf = tyreRadius(frontTyre);
    const rearX = -0.6;
    const frontX = 0.62;
    const rims = rimColour(m);

    for (const side of [1, -1] as const) {
        const rear = buildWheel(
            m,
            {
                tyre: rearTyre,
                rim: 'atv',
                brake: 'none',
                studs: 4,
                rimMaterial: rims,
            },
            side,
        );
        rear.position.set(rearX, Rr, side * 0.43);
        mower.add(rear);
        const front = buildWheel(
            m,
            {
                tyre: frontTyre,
                rim: 'atv',
                brake: 'none',
                studs: 4,
                rimMaterial: rims,
            },
            side,
        );
        front.position.set(frontX, Rf, side * 0.38);
        front.rotation.y = 0.15;
        mower.add(front);
    }

    // Frame rails, front axle and the deck with its spindles and chute.
    for (const side of [1, -1]) {
        mower.add(box(1.5, 0.08, 0.03, m.gloss, 0.05, 0.3, side * 0.2, 0.006));
    }

    mower.add(cyl(0.02, 0.78, m.gloss, 'z', frontX, Rf, 0));
    const deck = softBox(0.78, 0.12, 1.08, m.paintDark, 0.05, 0.16, 0, {
        divisions: [2, 1, 3],
        crease: 0.8,
        shape: (p) => {
            p.y += Math.cos((p.z / 0.54) * (Math.PI / 2)) * 0.02;
        },
    });
    mower.add(deck);

    for (const z of [0.27, -0.27]) {
        mower.add(puck(0.07, 0.05, m.gloss, 'y', 0.05, 0.25, z));
        mower.add(puck(0.05, 0.03, m.castAluminium, 'y', 0.05, 0.28, z));
    }

    // The discharge chute: a deflector flaring out and down from the deck.
    const chute = softBox(0.26, 0.07, 0.3, m.plastic, 0.02, 0.17, 0.68, {
        divisions: [2, 1, 2],
        crease: 0.5,
        shape: (p) => {
            const out = (p.z + 0.15) / 0.3;
            p.x *= 0.75 + out * 0.45;
            p.y -= out * 0.07;
        },
    });
    mower.add(chute);

    // Anti-scalp wheels on brackets at the deck's corners.
    for (const [x, z] of [
        [0.45, 0.5],
        [0.45, -0.5],
        [-0.36, 0.5],
        [-0.36, -0.5],
    ]) {
        const outward = Math.sign(z);
        mower.add(
            box(0.03, 0.09, 0.012, m.gloss, x, 0.1, z + outward * 0.012, 0.003),
        );
        mower.add(
            puck(0.035, 0.028, m.plastic, 'z', x, 0.036, z + outward * 0.035),
        );
        mower.add(cyl(0.006, 0.05, m.zinc, 'z', x, 0.036, z + outward * 0.025));
    }

    // Transaxle between the rear wheels, and the posts that carry the
    // rear fender pan off the frame.
    mower.add(
        softBox(0.26, 0.2, 0.3, m.castAluminium, rearX + 0.02, Rr + 0.02, 0, {
            crease: 0.9,
            divisions: [2, 2, 2],
        }),
    );
    mower.add(cyl(0.028, 0.62, m.gloss, 'z', rearX, Rr, 0));
    mower.add(puck(0.06, 0.02, m.gloss, 'z', rearX + 0.02, Rr + 0.02, 0.16));

    for (const x of [-0.25, -0.72]) {
        for (const side of [1, -1]) {
            mower.add(
                box(0.04, 0.2, 0.03, m.gloss, x, 0.42, side * 0.2, 0.006),
            );
        }
    }

    // Hood and grille, footrests, rear fender pan, seat, controls.
    const hood = softBox(0.62, 0.36, 0.56, m.paint, 0.62, 0.52, 0, {
        divisions: [3, 2, 2],
        levels: 3,
        crease: 0.4,
        shape: (p) => {
            const front = Math.max(0, p.x) / 0.31;
            p.y -= front * front * 0.08 * (p.y > 0 ? 1 : 0);
            p.z *= 1 - front * 0.1;
        },
    });
    mower.add(hood);
    mower.add(box(0.03, 0.18, 0.36, m.gloss, 0.93, 0.44, 0, 0.012));

    for (const side of [1, -1]) {
        mower.add(
            softBox(0.03, 0.05, 0.1, m.lens, 0.93, 0.58, side * 0.17, {
                crease: 0.5,
            }),
        );
        mower.add(
            softBox(0.5, 0.025, 0.2, m.plastic, 0.02, 0.38, side * 0.36, {
                crease: 0.5,
            }),
        );
    }

    mower.add(
        softBox(0.72, 0.16, 0.9, m.paint, -0.5, 0.56, 0, {
            divisions: [2, 1, 3],
            crease: 0.5,
            shape: (p) => {
                p.y += Math.pow(Math.abs(p.z) / 0.45, 3) * 0.06;
            },
        }),
    );
    mower.add(softBox(0.42, 0.1, 0.46, m.seat, -0.45, 0.7, 0, { crease: 0.3 }));
    mower.add(
        softBox(0.1, 0.44, 0.44, m.seat, -0.68, 0.94, 0, { crease: 0.3 }),
    );
    mower.add(
        softBox(0.24, 0.3, 0.3, m.plastic, 0.24, 0.62, 0, { crease: 0.4 }),
    );
    mower.add(rod([0.25, 0.72, 0], [0.18, 0.98, 0], 0.016, m.gloss));
    const wheel = torus(0.15, 0.016, m.gloss, 'y', 0.17, 1.0, 0, {
        radial: 10,
        tubular: 36,
    });
    wheel.rotation.z = 0.5;
    mower.add(wheel);
    mower.add(rod([0.17, 1.0, 0], [0.17, 1.0, 0.14], 0.01, m.gloss));
    mower.add(rod([-0.15, 0.62, 0.36], [-0.05, 0.85, 0.4], 0.01, m.gloss));
    mower.add(cyl(0.02, 0.05, m.red, 'y', -0.05, 0.86, 0.4));

    // A spring-loaded seat mount, seen under the pan.
    mower.add(
        coilSpring(
            new THREE.Vector3(-0.45, 0.5, 0.12),
            new THREE.Vector3(-0.45, 0.6, 0.12),
            0.025,
            0.004,
            5,
            m.steel,
        ),
    );

    mower.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });

    return {
        position: new THREE.Vector3(0.6, 0.48, 0),
        room: new THREE.Vector3(0.4, 0.34, 0.42),
        rotationY: 0,
        vertical: true,
        style: 'small',
    };
}
