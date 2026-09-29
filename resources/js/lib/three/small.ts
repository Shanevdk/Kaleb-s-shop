import * as THREE from 'three';
import type { Materials } from '@/lib/three/materials';
import type { EngineBay } from '@/lib/three/road';
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
    type Point,
    type Point3,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';
import { buildWheel, tyreRadius, type TyreSpec } from '@/lib/three/wheels';

function shadowed(group: THREE.Object3D): void {
    group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.shell = true;
        }
    });
}

/**
 * A three-blade propeller: each blade is a patch of a helicoid, so the
 * pitch twists from the root to the tip the way a real one does, with a
 * rounded outline and thickness that thins towards the tip. It turns
 * about the X axis.
 */
export function propeller(
    material: THREE.Material,
    diameter = 0.35,
    pitch = 0.43,
    blades = 3,
): THREE.Group {
    const group = new THREE.Group();
    const hub = 0.045;
    const tip = diameter / 2;
    const advance = pitch / (Math.PI * 2);
    const rings = 18;
    const across = 14;

    for (let b = 0; b < blades; b++) {
        const base = (b / blades) * Math.PI * 2;
        const positions: number[] = [];
        const index: number[] = [];

        for (const face of [1, -1]) {
            const offset = positions.length / 3;

            for (let i = 0; i <= rings; i++) {
                const t = i / rings;
                const r = hub + (tip - hub) * t;
                // Wide in the middle, rounded off at the tip.
                const chord =
                    (0.06 +
                        0.1 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.1))) *
                    Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
                const half = chord / 2 / r;
                const thickness = 0.008 * (1 - t * 0.8);
                // Skewed back towards the tip.
                const skew = t * t * 0.25;

                for (let j = 0; j <= across; j++) {
                    const s = j / across - 0.5;
                    const theta = base + skew + s * 2 * half;
                    const bulge = Math.cos(s * Math.PI) * thickness * face;
                    positions.push(
                        -advance * (theta - base) + bulge,
                        Math.cos(theta) * r,
                        Math.sin(theta) * r,
                    );
                }
            }

            for (let i = 0; i < rings; i++) {
                for (let j = 0; j < across; j++) {
                    const a = offset + i * (across + 1) + j;
                    const c = a + across + 1;

                    if (face === 1) {
                        index.push(a, c, a + 1, a + 1, c, c + 1);
                    } else {
                        index.push(a, a + 1, c, a + 1, c + 1, c);
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setIndex(index);
        geometry.computeVertexNormals();
        const blade = new THREE.Mesh(geometry, material);
        blade.castShadow = true;
        group.add(blade);
    }

    group.add(
        lathe(
            [
                [0, -0.09],
                [0.03, -0.085],
                [0.05, -0.05],
                [0.052, 0.04],
                [0.04, 0.07],
                [0, 0.08],
            ],
            material,
            'x',
        ),
    );

    return group;
}

/**
 * A 90 hp four-stroke outboard on a workshop stand: a smooth cowling over
 * the powerhead, the midsection down to the anti-ventilation plate, a
 * torpedo gearcase with its skeg, and a stainless prop.
 */
export function buildOutboard(m: Materials, group: THREE.Group): EngineBay {
    const motor = new THREE.Group();
    group.add(motor);

    // The stand: a steel trolley with a timber transom board.
    const stand = new THREE.Group();

    for (const side of [1, -1]) {
        stand.add(
            bentTube(
                [
                    [0.35, 0.08, side * 0.3],
                    [-0.35, 0.08, side * 0.3],
                ],
                0.02,
                m.gloss,
                0.02,
            ),
        );

        for (const x of [0.33, -0.33]) {
            stand.add(puck(0.04, 0.035, m.rubber, 'z', x, 0.045, side * 0.3));
            stand.add(
                box(0.03, 0.04, 0.03, m.gloss, x, 0.075, side * 0.3, 0.005),
            );
        }
    }

    stand.add(rod([0.3, 0.08, 0], [0.3, 1.02, 0], 0.025, m.gloss));
    stand.add(rod([0.35, 0.08, 0.3], [0.3, 0.9, 0], 0.016, m.gloss));
    stand.add(rod([0.35, 0.08, -0.3], [0.3, 0.9, 0], 0.016, m.gloss));
    const timber = new THREE.MeshStandardMaterial({
        color: 0x8a6440,
        roughness: 0.8,
    });
    stand.add(box(0.05, 0.36, 0.5, timber, 0.3, 1.18, 0, 0.008));
    motor.add(stand);

    // Clamp bracket over the transom, swivel bracket and trim rams.
    for (const side of [1, -1]) {
        motor.add(box(0.12, 0.34, 0.03, m.gloss, 0.29, 1.2, side * 0.12, 0.01));
        motor.add(
            rod(
                [0.37, 1.1, side * 0.12],
                [0.37, 1.24, side * 0.12],
                0.009,
                m.stainless,
            ),
        );
        motor.add(puck(0.025, 0.012, m.gloss, 'x', 0.385, 1.12, side * 0.12));
    }

    motor.add(cyl(0.02, 0.3, m.stainless, 'z', 0.24, 1.33, 0));
    motor.add(softBox(0.1, 0.4, 0.14, m.gloss, 0.19, 1.05, 0, { crease: 0.6 }));
    motor.add(rod([0.26, 0.96, 0], [0.18, 0.82, 0], 0.022, m.chrome));

    // Midsection down to the plate.
    const mid = softBox(0.26, 0.56, 0.14, m.paint, 0.03, 0.68, 0, {
        divisions: [2, 3, 1],
        crease: 0.2,
        shape: (p) => {
            // Streamlined: narrow at the trailing edge.
            p.z *= 1 - (Math.max(0, -p.x) / 0.13) * 0.45;
        },
    });
    motor.add(mid);

    // Anti-ventilation plate with its trim tab.
    motor.add(
        softBox(0.42, 0.018, 0.3, m.paint, -0.02, 0.4, 0, {
            divisions: [2, 1, 2],
            crease: 0.8,
            shape: (p) => {
                p.z *= 1 - (Math.max(0, p.x) / 0.21) * 0.5;
            },
        }),
    );
    motor.add(box(0.07, 0.01, 0.04, m.castAluminium, -0.22, 0.385, 0, 0.003));

    // Gearcase torpedo, water intakes, skeg.
    const torpedo = lathe(
        [
            [0, -0.2],
            [0.035, -0.19],
            [0.06, -0.14],
            [0.066, -0.02],
            [0.06, 0.12],
            [0.052, 0.18],
            [0, 0.19],
        ],
        m.paint,
        'x',
        0.02,
        0.28,
        0,
        32,
    );
    torpedo.rotation.z = Math.PI / 2;
    motor.add(torpedo);
    motor.add(
        softBox(0.12, 0.12, 0.05, m.paint, 0.02, 0.35, 0, { crease: 0.3 }),
    );
    motor.add(
        instanced(
            new THREE.BoxGeometry(0.03, 0.004, 0.012),
            m.gloss,
            Array.from({ length: 5 }, (_, i) => ({
                x: 0.04 + i * 0.012,
                y: 0.3,
                z: 0.064,
            })),
        ),
    );
    const skeg = softBox(0.16, 0.16, 0.022, m.paint, -0.06, 0.16, 0, {
        crease: 0.5,
        shape: (p) => {
            p.x -= (0.08 - p.y) * 0.5;
        },
    });
    motor.add(skeg);

    const prop = propeller(m.stainless, 0.34, 0.43);
    prop.position.set(-0.22, 0.28, 0);
    prop.rotation.x = 0.4;
    motor.add(prop);

    // The cowling: lower chaps and the smooth top.
    motor.add(
        softBox(0.62, 0.16, 0.42, m.gloss, 0.0, 1.02, 0, {
            divisions: [3, 1, 2],
            crease: 0.5,
            shape: (p) => {
                p.z *= 1 - (Math.max(0, -p.x) / 0.31) * 0.2;
            },
        }),
    );
    const cowl = softBox(0.66, 0.5, 0.44, m.paint, -0.02, 1.34, 0, {
        divisions: [3, 2, 2],
        levels: 3,
        shape: (p) => {
            const back = Math.max(0, -p.x) / 0.33;
            const up = (p.y + 0.25) / 0.5;
            p.z *= 1 - up * up * 0.28 - back * 0.1;
            p.y += Math.max(0, p.x) * 0.08 * up;
            p.x += up * 0.03;
        },
    });
    motor.add(cowl);
    motor.add(box(0.12, 0.02, 0.2, m.gloss, -0.22, 1.585, 0, 0.008));

    for (const side of [1, -1]) {
        motor.add(
            instanced(
                new THREE.BoxGeometry(0.1, 0.006, 0.004),
                m.gloss,
                Array.from({ length: 5 }, (_, i) => ({
                    x: -0.18,
                    y: 1.46 + i * 0.022,
                    z: side * 0.2,
                })),
            ),
        );
    }

    // Control cables and the flushing hose fitting.
    motor.add(
        tube(
            [
                [0.2, 1.05, 0.06],
                [0.35, 0.98, 0.15],
                [0.55, 0.9, 0.2],
            ],
            0.01,
            m.wire,
        ),
    );
    motor.add(
        tube(
            [
                [0.2, 1.05, -0.06],
                [0.35, 0.98, -0.15],
                [0.55, 0.88, -0.2],
            ],
            0.01,
            m.wire,
        ),
    );

    shadowed(motor);

    return {
        position: new THREE.Vector3(0.05, 1.25, 0),
        room: new THREE.Vector3(0.44, 0.36, 0.34),
        rotationY: 0,
        vertical: true,
        style: 'outboard',
    };
}

/**
 * An open-frame portable generator: a tube cage with rubber feet and
 * lifting handles, the tank on top, a single-cylinder engine at one end
 * and the alternator at the other with its outlets and breaker.
 */
export function buildGenerator(m: Materials, group: THREE.Group): EngineBay {
    const genset = new THREE.Group();
    group.add(genset);
    const L = 0.72;
    const W = 0.55;
    const H = 0.56;
    const r = 0.016;

    // Two side loops joined by cross tubes.
    for (const side of [1, -1]) {
        genset.add(
            bentTube(
                [
                    [-L / 2, 0.05, side * (W / 2)],
                    [L / 2, 0.05, side * (W / 2)],
                    [L / 2, H, side * (W / 2)],
                    [-L / 2, H, side * (W / 2)],
                ],
                r,
                m.gloss,
                0.06,
                { closed: true },
            ),
        );

        for (const x of [-L / 2 + 0.03, L / 2 - 0.03]) {
            genset.add(
                puck(0.03, 0.04, m.rubber, 'y', x, 0.02, side * (W / 2)),
            );
        }
    }

    for (const [x, y] of [
        [-L / 2, 0.05],
        [L / 2, 0.05],
        [-L / 2, H],
        [L / 2, H],
    ] as Point[]) {
        genset.add(rod([x, y, W / 2], [x, y, -W / 2], r, m.gloss));
    }

    genset.add(box(L - 0.06, 0.02, W - 0.06, m.gloss, 0, 0.08, 0, 0.004));

    // Tank on top with its cap and gauge.
    genset.add(
        softBox(L - 0.1, 0.17, W - 0.08, m.paint, 0, H + 0.06, 0, {
            divisions: [2, 1, 2],
            levels: 3,
            crease: 0.6,
            shape: (p) => {
                p.y += Math.cos((p.x / (L / 2)) * (Math.PI / 2)) * 0.02;
            },
        }),
    );
    genset.add(puck(0.04, 0.03, m.gloss, 'y', 0.12, H + 0.16, 0.08));
    genset.add(puck(0.025, 0.01, m.gloss, 'y', -0.15, H + 0.15, -0.1));
    genset.add(puck(0.02, 0.004, m.glass, 'y', -0.15, H + 0.157, -0.1));

    // Alternator: finned drum with an end cover and the control panel.
    genset.add(puck(0.15, 0.24, m.paint, 'x', -0.15, 0.27, 0));
    genset.add(
        lathe(
            [
                [0.15, 0],
                [0.14, 0.03],
                [0.1, 0.05],
                [0, 0.055],
            ],
            m.paint,
            'x',
            -0.27,
            0.27,
            0,
            32,
        ),
    );
    genset.children[genset.children.length - 1].rotation.z = Math.PI / 2;
    genset.add(
        instanced(
            new THREE.BoxGeometry(0.1, 0.012, 0.03),
            m.gloss,
            Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;

                return {
                    x: -0.06,
                    y: 0.27 + Math.cos(a) * 0.15,
                    z: Math.sin(a) * 0.15,
                    rx: -a,
                };
            }),
        ),
    );
    const panel = new THREE.Group();
    panel.position.set(-L / 2 + 0.03, 0.34, 0);
    panel.add(box(0.03, 0.3, 0.44, m.plastic, 0, 0, 0, 0.01));

    for (const z of [-0.12, 0.02]) {
        panel.add(puck(0.045, 0.02, m.orange, 'x', -0.02, -0.05, z));
        panel.add(
            box(0.012, 0.012, 0.004, m.gloss, -0.03, -0.05, z + 0.01, 0.001),
        );
        panel.add(
            box(0.012, 0.012, 0.004, m.gloss, -0.03, -0.05, z - 0.01, 0.001),
        );
    }

    panel.add(box(0.02, 0.05, 0.03, m.gloss, -0.02, 0.08, 0.14, 0.005));
    panel.add(puck(0.04, 0.01, m.gloss, 'x', -0.02, 0.07, -0.08));
    panel.add(puck(0.035, 0.004, m.glass, 'x', -0.026, 0.07, -0.08));
    panel.add(box(0.015, 0.04, 0.06, m.red, -0.02, 0.07, 0.04, 0.005));
    genset.add(panel);

    // Muffler with a heat guard beside the engine.
    genset.add(
        softBox(0.22, 0.14, 0.14, m.exhaust, 0.2, 0.44, -0.16, { crease: 0.8 }),
    );
    genset.add(
        softBox(0.24, 0.02, 0.16, m.gloss, 0.2, 0.53, -0.16, { crease: 0.5 }),
    );
    genset.add(cyl(0.012, 0.05, m.exhaust, 'z', 0.1, 0.44, -0.25));

    // Wheel kit and fold-down handle.
    const tyre: TyreSpec = {
        width: 0.07,
        aspect: 0.8,
        rim: 6,
        tread: 'turf',
        label: '8X2',
    };

    for (const side of [1, -1] as const) {
        const wheel = buildWheel(
            m,
            { tyre, rim: 'atv', brake: 'none', studs: 3 },
            side,
        );
        wheel.position.set(
            -L / 2 + 0.06,
            tyreRadius(tyre),
            side * (W / 2 + 0.07),
        );
        genset.add(wheel);
    }

    genset.add(
        cyl(0.01, W + 0.2, m.steel, 'z', -L / 2 + 0.06, tyreRadius(tyre), 0),
    );
    genset.add(
        bentTube(
            [
                [L / 2, H - 0.1, W / 2],
                [L / 2 + 0.25, H + 0.05, W / 2],
                [L / 2 + 0.25, H + 0.05, -W / 2],
                [L / 2, H - 0.1, -W / 2],
            ],
            0.014,
            m.gloss,
            0.06,
        ),
    );
    genset.add(cyl(0.02, 0.26, m.rubber, 'z', L / 2 + 0.25, H + 0.05, 0));

    shadowed(genset);

    return {
        position: new THREE.Vector3(0.14, 0.3, 0),
        room: new THREE.Vector3(0.34, 0.36, 0.4),
        rotationY: 0,
        exposed: true,
        style: 'small',
    };
}

/**
 * A 7x4 galvanised box trailer: deck and sides, an A-frame drawbar with
 * a ball coupling, jockey wheel and safety chains, one axle on leaf
 * springs, guards over the wheels, lamps and the plate at the back.
 */
export function buildTrailer(m: Materials, group: THREE.Group): EngineBay {
    const trailer = new THREE.Group();
    group.add(trailer);
    const L = 2.13;
    const W = 1.22;
    const deck = 0.6;
    const side = 0.42;
    const tyre: TyreSpec = {
        width: 0.185,
        aspect: 0.8,
        rim: 14,
        tread: 'trailer',
        label: 'C  8PR',
    };
    const R = tyreRadius(tyre);
    const galvanised = m.galvanised;

    trailer.add(box(L, 0.02, W, m.steel, 0, deck, 0, 0.004));

    for (const s of [1, -1]) {
        trailer.add(
            box(
                L,
                0.08,
                0.05,
                galvanised,
                0,
                deck - 0.05,
                s * (W / 2 - 0.02),
                0.006,
            ),
        );
        trailer.add(
            box(
                L,
                side,
                0.012,
                galvanised,
                0,
                deck + side / 2,
                s * (W / 2),
                0.004,
            ),
        );
        trailer.add(
            box(
                L + 0.02,
                0.04,
                0.04,
                galvanised,
                0,
                deck + side,
                s * (W / 2),
                0.006,
            ),
        );

        for (let i = 0; i <= 4; i++) {
            trailer.add(
                box(
                    0.03,
                    side,
                    0.02,
                    galvanised,
                    -L / 2 + (L / 4) * i,
                    deck + side / 2,
                    s * (W / 2 + 0.012),
                    0.004,
                ),
            );
        }
    }

    trailer.add(
        box(0.012, side, W, galvanised, L / 2, deck + side / 2, 0, 0.004),
    );
    trailer.add(
        box(0.04, 0.04, W + 0.02, galvanised, L / 2, deck + side, 0, 0.006),
    );
    trailer.add(
        box(
            0.03,
            side - 0.02,
            W - 0.04,
            galvanised,
            -L / 2,
            deck + side / 2,
            0,
            0.004,
        ),
    );
    trailer.add(box(0.04, 0.04, W, galvanised, -L / 2, deck + side, 0, 0.006));

    for (const s of [1, -1]) {
        trailer.add(
            cyl(
                0.012,
                0.06,
                m.steel,
                'z',
                -L / 2 - 0.01,
                deck + 0.05,
                s * (W / 2 - 0.1),
            ),
        );
    }

    // Drawbar and coupling.
    for (const s of [1, -1]) {
        trailer.add(
            rod(
                [L / 2 - 0.2, deck - 0.05, s * (W / 2 - 0.05)],
                [L / 2 + 1.25, deck - 0.05, s * 0.05],
                0.03,
                galvanised,
                6,
            ),
        );
    }

    trailer.add(
        box(0.42, 0.08, 0.1, galvanised, L / 2 + 1.35, deck - 0.03, 0, 0.01),
    );
    const coupling = softBox(0.2, 0.1, 0.1, galvanised, L / 2 + 1.58, deck, 0, {
        crease: 0.6,
    });
    trailer.add(coupling);
    trailer.add(
        rod(
            [L / 2 + 1.5, deck + 0.05, 0],
            [L / 2 + 1.64, deck + 0.08, 0],
            0.012,
            m.steel,
        ),
    );

    // Jockey wheel.
    const jockey = new THREE.Group();
    jockey.position.set(L / 2 + 0.85, 0, 0.2);
    jockey.add(cyl(0.03, 0.55, galvanised, 'y', 0, 0.38, 0));
    jockey.add(cyl(0.022, 0.3, m.steel, 'y', 0, 0.16, 0));
    jockey.add(
        bentTube(
            [
                [0, 0.66, 0],
                [0, 0.7, 0.06],
                [0.1, 0.7, 0.06],
            ],
            0.008,
            m.steel,
            0.02,
        ),
    );
    jockey.add(puck(0.1, 0.05, m.rubber, 'z', 0, 0.1, 0));
    jockey.add(puck(0.05, 0.055, m.zinc, 'z', 0, 0.1, 0));
    trailer.add(jockey);

    // Safety chains: links hung in a sag from the drawbar.
    const link = new THREE.TorusGeometry(0.012, 0.004, 6, 12);
    link.scale(1.6, 1, 1);

    for (const s of [1, -1]) {
        const transforms = [];
        const count = 14;

        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            transforms.push({
                x: L / 2 + 1.25 + t * 0.32,
                y: deck - 0.08 - Math.sin(Math.PI * t) * 0.14,
                z: s * 0.07,
                rx: i % 2 === 0 ? 0 : Math.PI / 2,
                rz: Math.cos(Math.PI * t) * -0.8,
            });
        }

        trailer.add(instanced(link, galvanised, transforms));
    }

    // Axle on leaf springs, wheels and guards.
    const axle = -0.12;

    for (const s of [1, -1] as const) {
        const wheel = buildWheel(
            m,
            { tyre, rim: 'trailer', brake: 'none', studs: 5 },
            s,
        );
        wheel.position.set(axle, R, s * (W / 2 + 0.12));
        trailer.add(wheel);

        for (let leaf = 0; leaf < 3; leaf++) {
            const length = 0.8 - leaf * 0.18;
            const points: Point3[] = [];

            for (let i = 0; i <= 6; i++) {
                const t = i / 6 - 0.5;
                points.push([
                    axle + t * length,
                    R + 0.08 - leaf * 0.012 + t * t * 0.12,
                    s * (W / 2 - 0.08),
                ]);
            }

            trailer.add(
                bentTube(points, 0.007, m.castIron, 0.05, { radial: 6 }),
            );
        }

        const guard = torus(
            R + 0.06,
            0.018,
            galvanised,
            'z',
            axle,
            R,
            s * (W / 2 + 0.12),
            {
                arc: Math.PI,
                radial: 6,
                tubular: 30,
            },
        );
        guard.scale.z = 6;
        trailer.add(guard);
        trailer.add(
            box(
                0.03,
                0.12,
                0.02,
                galvanised,
                axle - 0.3,
                deck - 0.02,
                s * (W / 2 + 0.05),
                0.004,
            ),
        );

        // Combination lamps on the back corners.
        trailer.add(
            softBox(
                0.04,
                0.09,
                0.2,
                m.redLens,
                -L / 2 - 0.04,
                deck - 0.06,
                s * (W / 2 - 0.12),
                { crease: 0.6 },
            ),
        );
        trailer.add(
            box(
                0.03,
                0.03,
                0.05,
                m.amberLens,
                -L / 2 - 0.05,
                deck - 0.02,
                s * (W / 2 - 0.18),
                0.004,
            ),
        );
    }

    trailer.add(cyl(0.035, W + 0.12, galvanised, 'z', axle, R, 0));
    trailer.add(
        box(0.012, 0.13, 0.37, m.plate, -L / 2 - 0.06, deck - 0.2, 0, 0.004),
    );
    trailer.add(
        box(0.04, 0.02, 0.4, galvanised, -L / 2 - 0.03, deck - 0.12, 0, 0.004),
    );

    shadowed(trailer);

    return {
        position: new THREE.Vector3(0, deck, 0),
        room: new THREE.Vector3(0, 0, 0),
        rotationY: 0,
    };
}

/**
 * For a machine that is none of the others: a two-seat side-by-side with
 * a roll cage, a tipping tray and all-terrain tyres, its engine mid-mounted
 * under the tray.
 */
export function buildUtility(m: Materials, group: THREE.Group): EngineBay {
    const utv = new THREE.Group();
    group.add(utv);
    const tyre: TyreSpec = {
        width: 0.23,
        aspect: 0.65,
        rim: 12,
        tread: 'allTerrain',
        label: '26X9-12',
    };
    const R = tyreRadius(tyre);
    const axles = [0.95, -0.95];
    const track = 0.65;

    for (const x of axles) {
        for (const side of [1, -1] as const) {
            const wheel = buildWheel(
                m,
                { tyre, rim: 'atv', brake: 'disc', studs: 4 },
                side,
            );
            wheel.position.set(x, R, side * track);
            utv.add(wheel);
        }
    }

    // Chassis, floor, hood, dash.
    for (const side of [1, -1]) {
        utv.add(box(2.4, 0.08, 0.05, m.gloss, 0, 0.38, side * 0.4, 0.008));
    }

    utv.add(box(1.0, 0.03, 1.2, m.plastic, 0.2, 0.42, 0, 0.006));
    utv.add(
        softBox(0.75, 0.3, 1.36, m.paint, 1.1, 0.7, 0, {
            divisions: [3, 1, 3],
            levels: 3,
            shape: (p) => {
                const front = Math.max(0, p.x) / 0.375;
                p.y -= front * front * 0.1;
                p.y += Math.pow(Math.abs(p.z) / 0.68, 4) * 0.06;
            },
        }),
    );

    for (const side of [1, -1]) {
        utv.add(
            softBox(0.04, 0.06, 0.16, m.lens, 1.46, 0.7, side * 0.42, {
                crease: 0.6,
            }),
        );
        const guard = torus(
            R + 0.05,
            0.03,
            m.paint,
            'z',
            axles[0],
            R,
            side * track,
            {
                arc: Math.PI * 0.6,
                start: Math.PI * 0.2,
                radial: 8,
                tubular: 30,
            },
        );
        guard.scale.z = 4;
        utv.add(guard);
    }

    utv.add(softBox(0.3, 0.26, 1.2, m.dash, 0.62, 0.78, 0, { crease: 0.5 }));
    const wheel = torus(0.17, 0.016, m.gloss, 'y', 0.42, 0.98, -0.3, {
        radial: 10,
        tubular: 36,
    });
    wheel.rotation.z = 0.9;
    utv.add(wheel);
    utv.add(rod([0.42, 0.98, -0.3], [0.55, 0.85, -0.3], 0.015, m.gloss));

    // Bench seats and the roll cage.
    for (const z of [-0.3, 0.3]) {
        utv.add(
            softBox(0.46, 0.12, 0.5, m.seat, -0.1, 0.62, z, { crease: 0.4 }),
        );
        utv.add(
            softBox(0.12, 0.5, 0.5, m.seat, -0.34, 0.9, z, { crease: 0.4 }),
        );
    }

    for (const side of [1, -1]) {
        utv.add(
            bentTube(
                [
                    [0.6, 0.72, side * 0.62],
                    [0.28, 1.82, side * 0.58],
                    [-0.52, 1.82, side * 0.58],
                    [-0.52, 0.72, side * 0.62],
                ],
                0.025,
                m.gloss,
                0.15,
            ),
        );
    }

    utv.add(rod([0.28, 1.82, 0.58], [0.28, 1.82, -0.58], 0.025, m.gloss));
    utv.add(rod([-0.52, 1.82, 0.58], [-0.52, 1.82, -0.58], 0.025, m.gloss));
    utv.add(rod([-0.52, 1.25, 0.6], [-0.52, 1.25, -0.6], 0.02, m.gloss));
    utv.add(
        softBox(0.9, 0.04, 1.2, m.plastic, -0.12, 1.86, 0, { crease: 0.6 }),
    );

    // Tipping tray over the engine.
    const trayFront = -0.6;
    const trayRear = -1.45;
    utv.add(
        box(
            trayFront - trayRear,
            0.03,
            1.3,
            m.gloss,
            (trayFront + trayRear) / 2,
            0.82,
            0,
            0.006,
        ),
    );

    for (const side of [1, -1]) {
        utv.add(
            box(
                trayFront - trayRear,
                0.26,
                0.03,
                m.paint,
                (trayFront + trayRear) / 2,
                0.95,
                side * 0.64,
                0.008,
            ),
        );
    }

    utv.add(box(0.03, 0.26, 1.3, m.paint, trayRear, 0.95, 0, 0.008));
    utv.add(box(0.03, 0.26, 1.3, m.paint, trayFront, 0.95, 0, 0.008));

    for (const side of [1, -1]) {
        utv.add(
            softBox(
                0.03,
                0.08,
                0.12,
                m.redLens,
                trayRear - 0.02,
                0.9,
                side * 0.5,
                { crease: 0.6 },
            ),
        );
    }

    shadowed(utv);

    return {
        position: new THREE.Vector3(-1.0, 0.56, 0),
        room: new THREE.Vector3(0.5, 0.36, 0.5),
        rotationY: Math.PI / 2,
        exposed: true,
        style: 'small',
    };
}
