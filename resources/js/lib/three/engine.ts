import * as THREE from 'three';
import type { EnginePartKey } from '@/lib/engine-parts';
import type { Materials } from '@/lib/three/materials';
import {
    bolts,
    box,
    cyl,
    instanced,
    place,
    sphere,
    torus,
    tube,
    type Point3,
    type Transform,
} from '@/lib/three/shapes';

export type EngineInput = {
    cylinders: number | null;
    displacement: number | null;
    configuration: string | null;
    fuel: string | null;
    turbo: boolean | null;
};

export type PartMap = Map<EnginePartKey, THREE.Mesh[]>;

/**
 * Build an engine from its specs into the group, registering every mesh
 * against the part it belongs to so it can be hovered and clicked.
 *
 * +X is the front of the engine (belt end), +Y is up, +Z is the right bank.
 * Cylinder count, layout, fuel and turbo all change what gets built: a V8
 * with a turbo looks nothing like a single-cylinder mower engine.
 */
export function buildEngine(
    input: EngineInput,
    m: Materials,
    group: THREE.Group,
    parts: PartMap,
): void {
    const cylinders = Math.min(
        12,
        Math.max(1, Math.round(input.cylinders ?? 4)),
    );
    const configuration = (input.configuration ?? '').toLowerCase();
    const isFlat =
        configuration.includes('flat') ||
        configuration.includes('boxer') ||
        configuration.includes('horizontal');
    const isVee =
        !isFlat &&
        (configuration.startsWith('v') ||
            configuration.includes('vee') ||
            (configuration === '' && cylinders >= 8));
    const isDiesel = (input.fuel ?? '').toLowerCase().includes('diesel');
    const hasTurbo =
        input.turbo === true ||
        (input.turbo === null && isDiesel && cylinders >= 3);
    const isSmall = cylinders <= 2;
    const banks = isVee || isFlat ? 2 : 1;
    const perBank = Math.ceil(cylinders / banks);

    const bore = 0.24;
    const pitch = bore * 1.22;
    const blockLength = Math.max(0.6, perBank * pitch + 0.24);
    const blockHeight = isSmall ? 0.46 : 0.6;
    const blockWidth = isVee ? 0.72 : isFlat ? 1.1 : 0.54;
    const front = blockLength / 2;
    const top = blockHeight / 2;

    const add = <T extends THREE.Object3D>(
        key: EnginePartKey,
        object: T,
        parent: THREE.Object3D = group,
    ): T => {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = (child.material as THREE.Material).clone();
                child.userData.part = key;
                parts.set(key, [...(parts.get(key) ?? []), child]);
            }
        });
        parent.add(object);

        return object;
    };

    /* Block, sump, timing cover, mounts. */
    add(
        'block',
        box(blockLength, blockHeight, blockWidth, m.iron, 0, 0, 0, 0.02),
    );
    const bossGeometry = new THREE.CylinderGeometry(
        bore * 0.36,
        bore * 0.36,
        0.03,
        20,
    );
    const bosses: Transform[] = [];
    for (let i = 0; i < perBank; i++) {
        const x = (i - (perBank - 1) / 2) * pitch;
        bosses.push({
            x,
            y: top * 0.2,
            z: blockWidth / 2 + 0.01,
            rx: Math.PI / 2,
        });
        bosses.push({
            x,
            y: top * 0.2,
            z: -blockWidth / 2 - 0.01,
            rx: Math.PI / 2,
        });
    }
    add('block', instanced(bossGeometry, m.iron, bosses));
    add(
        'block',
        box(
            0.06,
            blockHeight * 0.9,
            blockWidth * 0.9,
            m.steel,
            front + 0.02,
            0,
            0,
            0.02,
        ),
    );
    add(
        'block',
        bolts(
            m.steel,
            0.012,
            [
                [front + 0.055, top * 0.7, blockWidth * 0.35],
                [front + 0.055, top * 0.7, -blockWidth * 0.35],
                [front + 0.055, -top * 0.7, blockWidth * 0.35],
                [front + 0.055, -top * 0.7, -blockWidth * 0.35],
            ],
            'x',
        ),
    );
    add(
        'sump',
        box(
            blockLength * 0.92,
            0.12,
            blockWidth * 0.86,
            m.iron,
            0,
            -top - 0.06,
            0,
            0.02,
        ),
    );
    add(
        'sump',
        box(
            blockLength * 0.5,
            0.16,
            blockWidth * 0.7,
            m.iron,
            -blockLength * 0.15,
            -top - 0.2,
            0,
            0.04,
        ),
    );
    add(
        'sump',
        cyl(
            0.02,
            0.02,
            m.chrome,
            'y',
            -blockLength * 0.15,
            -top - 0.29,
            blockWidth * 0.2,
            { segments: 6 },
        ),
    );
    for (const z of [blockWidth / 2 + 0.06, -blockWidth / 2 - 0.06]) {
        add('block', box(0.12, 0.08, 0.1, m.rubber, 0, -top * 0.5, z, 0.02));
    }

    /* Oil filter and dipstick. */
    add(
        'filter',
        cyl(
            0.06,
            0.13,
            m.plate,
            'z',
            -blockLength * 0.2,
            -top * 0.3,
            blockWidth / 2 + 0.09,
            { segments: 24 },
        ),
    );
    add(
        'filter',
        cyl(
            0.065,
            0.02,
            m.steel,
            'z',
            -blockLength * 0.2,
            -top * 0.3,
            blockWidth / 2 + 0.03,
            { segments: 24 },
        ),
    );
    add(
        'block',
        tube(
            [
                [blockLength * 0.1, -top * 0.2, -blockWidth / 2 - 0.02],
                [blockLength * 0.15, top + 0.25, -blockWidth / 2 - 0.08],
            ],
            0.008,
            m.steel,
            { segments: 6 },
        ),
    );
    add(
        'block',
        cyl(
            0.02,
            0.02,
            m.plastic,
            'y',
            blockLength * 0.15,
            top + 0.26,
            -blockWidth / 2 - 0.08,
        ),
    );

    /* Heads, valve covers, plugs, cooling fins, manifolds: one per bank. */
    const bankAngles = isVee
        ? [-0.55, 0.55]
        : isFlat
          ? [-Math.PI / 2, Math.PI / 2]
          : [0];
    const headHeight = 0.2;
    const coverHeight = 0.11;

    bankAngles.forEach((angle, bankIndex) => {
        const bank = new THREE.Group();
        bank.rotation.x = angle;
        bank.position.y = isFlat ? 0 : top;
        group.add(bank);

        const headWidth = isFlat
            ? blockWidth * 0.42
            : blockWidth * (isVee ? 0.5 : 0.92);
        const headZ = isVee ? (bankIndex === 0 ? -0.06 : 0.06) : 0;
        const headY = isFlat ? blockWidth / 2 + headHeight / 2 : headHeight / 2;
        const coverY = headY + headHeight / 2 + coverHeight / 2;
        const count =
            bankIndex === banks - 1
                ? cylinders - perBank * (banks - 1)
                : perBank;

        add(
            'head',
            box(
                blockLength * 0.96,
                headHeight,
                headWidth,
                m.steel,
                0,
                headY,
                headZ,
                0.01,
            ),
            bank,
        );
        add(
            'head',
            box(
                blockLength * 0.86,
                coverHeight,
                headWidth * 0.78,
                m.iron,
                0,
                coverY,
                headZ,
                0.03,
            ),
            bank,
        );
        add(
            'head',
            cyl(
                0.035,
                0.03,
                m.plastic,
                'y',
                -blockLength * 0.3,
                coverY + coverHeight / 2 + 0.01,
                headZ + headWidth * 0.2,
            ),
            bank,
        );

        const coverBolts: Point3[] = [];
        for (let i = 0; i <= count; i++) {
            const x =
                -blockLength * 0.4 +
                (blockLength * 0.8 * i) / Math.max(1, count);
            coverBolts.push([
                x,
                coverY + coverHeight / 2,
                headZ + headWidth * 0.36,
            ]);
            coverBolts.push([
                x,
                coverY + coverHeight / 2,
                headZ - headWidth * 0.36,
            ]);
        }
        add('head', bolts(m.steel, 0.008, coverBolts), bank);

        const intakeSide = isVee ? (bankIndex === 0 ? 1 : -1) : 1;
        const exhaustSide = isVee ? (bankIndex === 0 ? -1 : 1) : -1;

        for (let i = 0; i < count; i++) {
            const x = (i - (count - 1) / 2) * pitch;

            // Coil packs or glow plug leads on top of each cylinder.
            add(
                'head',
                cyl(
                    0.028,
                    0.06,
                    m.plastic,
                    'y',
                    x,
                    coverY + coverHeight / 2 + 0.03,
                    headZ,
                    { segments: 12 },
                ),
                bank,
            );
            add(
                'head',
                box(
                    0.05,
                    0.03,
                    0.06,
                    m.plastic,
                    x,
                    coverY + coverHeight / 2 + 0.07,
                    headZ,
                    0.008,
                ),
                bank,
            );

            if (isSmall) {
                // Air cooled: a stack of fins around each barrel and the head.
                const fin = new THREE.BoxGeometry(
                    bore * 1.7,
                    0.01,
                    blockWidth * 1.2,
                );
                const fins: Transform[] = [];
                for (let f = 0; f < 8; f++) {
                    fins.push({
                        x,
                        y: headY - headHeight / 2 - 0.03 - f * 0.05,
                        z: 0,
                    });
                }
                add('fins', instanced(fin, m.steel, fins), bank);
            }

            if (!isFlat) {
                add(
                    'intake',
                    cyl(
                        0.032,
                        0.2,
                        m.steel,
                        'z',
                        x,
                        headY + 0.02,
                        headZ + intakeSide * (headWidth / 2 + 0.09),
                        { segments: 14 },
                    ),
                    bank,
                );
                add(
                    'fuel',
                    cyl(
                        0.016,
                        0.07,
                        m.steel,
                        'y',
                        x,
                        headY + 0.13,
                        headZ + intakeSide * (headWidth / 2 + 0.05),
                        { segments: 10 },
                    ),
                    bank,
                );
                add(
                    'exhaust',
                    tube(
                        [
                            [
                                x,
                                headY - 0.04,
                                headZ + exhaustSide * (headWidth / 2 - 0.02),
                            ],
                            [
                                x,
                                headY - 0.06,
                                headZ + exhaustSide * (headWidth / 2 + 0.12),
                            ],
                            [
                                x * 0.55,
                                headY - 0.22,
                                headZ + exhaustSide * (headWidth / 2 + 0.22),
                            ],
                        ],
                        0.03,
                        m.heat,
                        { segments: 10, radial: 12 },
                    ),
                    bank,
                );
            }
        }

        if (!isFlat) {
            // Plenum, throttle body and fuel rail on the intake side; the
            // collector on the exhaust side.
            const plenumZ = headZ + intakeSide * (headWidth / 2 + 0.22);
            add(
                'intake',
                box(
                    blockLength * 0.82,
                    0.13,
                    0.14,
                    m.steel,
                    0,
                    headY + 0.03,
                    plenumZ,
                    0.05,
                ),
                bank,
            );
            add(
                'intake',
                cyl(
                    0.05,
                    0.08,
                    m.steel,
                    'x',
                    blockLength * 0.45,
                    headY + 0.03,
                    plenumZ,
                    { segments: 20 },
                ),
                bank,
            );
            add(
                'fuel',
                tube(
                    [
                        [
                            -blockLength * 0.42,
                            headY + 0.17,
                            headZ + intakeSide * (headWidth / 2 + 0.05),
                        ],
                        [
                            blockLength * 0.42,
                            headY + 0.17,
                            headZ + intakeSide * (headWidth / 2 + 0.05),
                        ],
                    ],
                    0.014,
                    m.steel,
                    { segments: 4 },
                ),
                bank,
            );
            add(
                'exhaust',
                cyl(
                    0.045,
                    blockLength * 0.6,
                    m.heat,
                    'x',
                    0,
                    headY - 0.24,
                    headZ + exhaustSide * (headWidth / 2 + 0.24),
                    { segments: 14 },
                ),
                bank,
            );
            add(
                'exhaust',
                box(
                    0.09,
                    0.12,
                    0.12,
                    m.heat,
                    -blockLength * 0.3,
                    headY - 0.26,
                    headZ + exhaustSide * (headWidth / 2 + 0.24),
                    0.01,
                ),
                bank,
            );
        } else {
            add(
                'intake',
                box(
                    0.14,
                    0.14,
                    blockWidth * 0.8,
                    m.steel,
                    0,
                    headY + headWidth / 2 + 0.1,
                    0,
                    0.04,
                ),
                bank,
            );
            add(
                'exhaust',
                cyl(
                    0.045,
                    blockLength * 0.8,
                    m.heat,
                    'x',
                    0,
                    headY - headWidth / 2 - 0.1,
                    0,
                ),
                bank,
            );
        }
    });

    if (isVee) {
        add(
            'intake',
            box(
                blockLength * 0.66,
                0.16,
                0.42,
                m.steel,
                0,
                top + 0.34,
                0,
                0.06,
            ),
        );
        add(
            'intake',
            cyl(0.055, 0.1, m.steel, 'x', blockLength * 0.38, top + 0.36, 0, {
                segments: 20,
            }),
        );
    }

    /* Turbo: compressor snail, turbine housing, cartridge, wastegate. */
    if (hasTurbo) {
        const side = isVee ? 0.05 : -(blockWidth / 2 + 0.4);
        const turboY = isVee ? top + 0.45 : top * 0.3;
        const turboX = -blockLength * 0.1;
        const turbo = new THREE.Group();
        turbo.position.set(turboX, turboY, side);
        turbo.add(
            torus(0.11, 0.065, m.steel, 'z', 0, 0, 0.08, {
                radial: 14,
                tubular: 32,
            }),
        );
        turbo.add(cyl(0.05, 0.1, m.steel, 'z', 0, 0, 0.13, { segments: 20 }));
        turbo.add(
            torus(0.1, 0.06, m.heat, 'z', 0, 0, -0.08, {
                radial: 14,
                tubular: 32,
            }),
        );
        turbo.add(cyl(0.05, 0.14, m.iron, 'z', 0, 0, 0, { segments: 20 }));
        turbo.add(
            cyl(0.05, 0.16, m.heat, 'y', 0, -0.13, -0.08, { segments: 16 }),
        );
        turbo.add(
            cyl(0.03, 0.09, m.steel, 'y', 0.12, 0.09, 0.08, { segments: 12 }),
        );
        turbo.add(
            cyl(0.008, 0.16, m.chrome, 'y', 0.12, -0.03, 0.08, { segments: 8 }),
        );
        turbo.add(
            tube(
                [
                    [0.03, 0.03, 0.14],
                    [0.2, 0.1, 0.3],
                    [0.35, 0.28, 0.32],
                ],
                0.04,
                m.plastic,
                { segments: 10 },
            ),
        );
        add('turbo', turbo);
    }

    /* Airbox with intake trunk and a clamp. */
    const airZ = isVee ? 0.42 : blockWidth / 2 + 0.44;
    add(
        'airbox',
        box(
            0.38,
            0.22,
            0.32,
            m.plastic,
            -blockLength * 0.25,
            top + 0.52,
            airZ,
            0.04,
        ),
    );
    add(
        'airbox',
        box(
            0.36,
            0.02,
            0.3,
            m.plastic,
            -blockLength * 0.25,
            top + 0.64,
            airZ,
            0.01,
        ),
    );
    add(
        'airbox',
        bolts(m.steel, 0.01, [
            [-blockLength * 0.25 - 0.15, top + 0.66, airZ + 0.12],
            [-blockLength * 0.25 + 0.15, top + 0.66, airZ + 0.12],
            [-blockLength * 0.25 - 0.15, top + 0.66, airZ - 0.12],
            [-blockLength * 0.25 + 0.15, top + 0.66, airZ - 0.12],
        ]),
    );
    add(
        'airbox',
        tube(
            [
                [-blockLength * 0.1, top + 0.5, airZ - 0.1],
                [blockLength * 0.15, top + 0.4, airZ - 0.18],
                [
                    blockLength * 0.42,
                    top + 0.2,
                    isVee ? 0.05 : blockWidth / 2 + 0.28,
                ],
            ],
            0.045,
            m.rubber,
            { segments: 12 },
        ),
    );
    add(
        'airbox',
        torus(
            0.05,
            0.008,
            m.steel,
            'x',
            -blockLength * 0.1,
            top + 0.5,
            airZ - 0.1,
        ),
    );

    /* Front of the engine: crank pulley, water pump, alternator, tensioner, belt. */
    const crankY = -top + 0.12;
    const crank = { x: front + 0.1, y: crankY, z: 0 };
    const alternator = {
        x: front + 0.06,
        y: top + 0.08,
        z: blockWidth / 2 + 0.08,
    };
    const pump = { x: front + 0.08, y: top * 0.2, z: -blockWidth / 4 };
    const tensioner = { x: front + 0.08, y: top * 0.45, z: blockWidth / 4 };

    add(
        'belt',
        cyl(0.13, 0.05, m.iron, 'x', crank.x, crank.y, crank.z, {
            segments: 32,
        }),
    );
    add(
        'belt',
        cyl(0.135, 0.008, m.plastic, 'x', crank.x + 0.02, crank.y, crank.z, {
            segments: 32,
        }),
    );
    add(
        'belt',
        cyl(0.135, 0.008, m.plastic, 'x', crank.x - 0.02, crank.y, crank.z, {
            segments: 32,
        }),
    );
    add(
        'belt',
        cyl(0.03, 0.06, m.steel, 'x', crank.x + 0.02, crank.y, crank.z, {
            segments: 12,
        }),
    );
    add(
        'belt',
        cyl(0.06, 0.05, m.steel, 'x', pump.x, pump.y, pump.z, { segments: 24 }),
    );
    add(
        'belt',
        cyl(0.04, 0.04, m.steel, 'x', tensioner.x, tensioner.y, tensioner.z, {
            segments: 24,
        }),
    );
    add(
        'belt',
        box(
            0.04,
            0.16,
            0.05,
            m.iron,
            tensioner.x - 0.03,
            tensioner.y - 0.08,
            tensioner.z,
        ),
    );

    const alt = new THREE.Group();
    alt.position.set(alternator.x, alternator.y, alternator.z);
    alt.add(cyl(0.1, 0.2, m.steel, 'x', -0.1, 0, 0, { segments: 28 }));
    alt.add(cyl(0.085, 0.05, m.plastic, 'x', -0.22, 0, 0, { segments: 28 }));
    const slot = new THREE.BoxGeometry(0.04, 0.03, 0.012);
    const slots: Transform[] = [];
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        slots.push({
            x: -0.12,
            y: Math.cos(a) * 0.095,
            z: Math.sin(a) * 0.095,
            rx: -a,
        });
    }
    alt.add(instanced(slot, m.plastic, slots));
    alt.add(cyl(0.055, 0.04, m.steel, 'x', 0.02, 0, 0, { segments: 24 }));
    alt.add(cyl(0.018, 0.03, m.chrome, 'x', 0.05, 0, 0, { segments: 8 }));
    alt.add(box(0.04, 0.1, 0.05, m.iron, -0.1, -0.12, -0.04));
    add('alternator', alt);

    const beltX = front + 0.06;
    add(
        'belt',
        tube(
            [
                [beltX, crank.y - 0.13, crank.z],
                [beltX, pump.y - 0.05, pump.z - 0.04],
                [beltX, pump.y + 0.06, pump.z - 0.02],
                [beltX, alternator.y + 0.055, alternator.z - 0.02],
                [beltX, alternator.y - 0.02, alternator.z + 0.05],
                [beltX, tensioner.y + 0.02, tensioner.z + 0.04],
                [beltX, crank.y + 0.05, crank.z + 0.125],
            ],
            0.012,
            m.rubber,
            { closed: true, segments: 64, radial: 8, tension: 0.35 },
        ),
    );

    /* Back of the engine: bell housing, flywheel, starter. */
    const bell = new THREE.Mesh(
        new THREE.LatheGeometry(
            [
                new THREE.Vector2(0, 0),
                new THREE.Vector2(blockHeight * 0.4, 0),
                new THREE.Vector2(blockHeight * 0.62, 0.08),
                new THREE.Vector2(blockHeight * 0.66, 0.22),
                new THREE.Vector2(blockHeight * 0.58, 0.24),
                new THREE.Vector2(0, 0.24),
            ],
            40,
        ),
        m.iron,
    );
    bell.rotation.z = Math.PI / 2;
    place(bell, -front - 0.02, -0.04, 0);
    add('flywheel', bell);
    add(
        'flywheel',
        bolts(
            m.steel,
            0.01,
            [0, 1, 2, 3, 4, 5].map((i) => {
                const a = (i / 6) * Math.PI * 2;
                return [
                    -front - 0.03,
                    -0.04 + Math.cos(a) * blockHeight * 0.52,
                    Math.sin(a) * blockHeight * 0.52,
                ] as Point3;
            }),
            'x',
        ),
    );
    const starter = new THREE.Group();
    starter.position.set(-front - 0.12, -top + 0.1, blockWidth / 2 + 0.1);
    starter.add(cyl(0.05, 0.22, m.steel, 'x', 0, 0, 0, { segments: 24 }));
    starter.add(
        cyl(0.035, 0.14, m.steel, 'x', -0.02, 0.07, 0, { segments: 20 }),
    );
    starter.add(cyl(0.02, 0.02, m.plastic, 'x', 0.1, 0.07, 0));
    add('starter', starter);

    /* Water cooled engines get a radiator, fan and hoses out the front. */
    if (!isSmall) {
        const radX = front + 0.58;
        const radH = blockHeight + 0.42;
        const radW = blockWidth + 0.5;
        const radiator = new THREE.Group();
        radiator.position.set(radX, 0.06, 0);
        radiator.add(box(0.06, radH - 0.16, radW - 0.1, m.plastic, 0, 0, 0));
        const fin = new THREE.BoxGeometry(0.05, radH - 0.18, 0.004);
        const finRows: Transform[] = [];
        const finCount = Math.floor((radW - 0.14) / 0.02);
        for (let i = 0; i < finCount; i++) {
            finRows.push({ x: 0, y: 0, z: -radW / 2 + 0.07 + i * 0.02 });
        }
        radiator.add(instanced(fin, m.steel, finRows));
        radiator.add(
            box(0.09, 0.08, radW, m.plastic, 0, radH / 2 - 0.04, 0, 0.02),
        );
        radiator.add(
            box(0.09, 0.08, radW, m.plastic, 0, -radH / 2 + 0.04, 0, 0.02),
        );
        radiator.add(
            cyl(0.03, 0.04, m.plastic, 'y', 0, radH / 2 + 0.02, radW * 0.3),
        );
        radiator.add(
            box(0.03, radH - 0.16, 0.03, m.steel, 0, 0, radW / 2 - 0.03),
        );
        radiator.add(
            box(0.03, radH - 0.16, 0.03, m.steel, 0, 0, -radW / 2 + 0.03),
        );
        radiator.add(
            cyl(0.11, 0.04, m.plastic, 'x', -0.12, 0.02, 0, { segments: 24 }),
        );
        const blade = new THREE.BoxGeometry(0.02, 0.2, 0.08);
        const blades: Transform[] = [];
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            blades.push({
                x: -0.14,
                y: 0.02 + Math.cos(a) * 0.15,
                z: Math.sin(a) * 0.15,
                rx: -a,
                ry: 0.5,
            });
        }
        radiator.add(instanced(blade, m.plastic, blades));
        radiator.add(torus(0.26, 0.012, m.plastic, 'x', -0.14, 0.02, 0));
        add('radiator', radiator);

        add(
            'radiator',
            tube(
                [
                    [radX - 0.05, radH / 2 - 0.02, -radW * 0.3],
                    [front + 0.3, top + 0.12, -blockWidth * 0.3],
                    [front + 0.05, top + 0.02, -blockWidth * 0.3],
                ],
                0.03,
                m.rubber,
                { segments: 12 },
            ),
        );
        add(
            'radiator',
            tube(
                [
                    [radX - 0.05, -radH / 2 + 0.06, radW * 0.28],
                    [front + 0.32, -top * 0.3, blockWidth * 0.1],
                    [pump.x + 0.02, pump.y, pump.z],
                ],
                0.03,
                m.rubber,
                { segments: 12 },
            ),
        );
        add(
            'head',
            cyl(
                0.045,
                0.06,
                m.steel,
                'x',
                front + 0.04,
                top + 0.02,
                -blockWidth * 0.3,
                { segments: 16 },
            ),
        );
    } else {
        // Small engines: recoil starter, flywheel shroud, carburettor, muffler.
        add(
            'fins',
            cyl(
                blockHeight * 0.55,
                0.06,
                m.plastic,
                'x',
                front + 0.08,
                0.02,
                0,
                { segments: 32 },
            ),
        );
        add(
            'fins',
            cyl(blockHeight * 0.2, 0.02, m.steel, 'x', front + 0.12, 0.02, 0, {
                segments: 24,
            }),
        );
        add(
            'fins',
            box(
                0.08,
                0.03,
                0.05,
                m.plastic,
                front + 0.14,
                0.02 + blockHeight * 0.2,
                0,
                0.01,
            ),
        );
        add(
            'intake',
            box(
                0.08,
                0.08,
                0.08,
                m.steel,
                0,
                top + 0.14,
                blockWidth / 2 + 0.16,
                0.01,
            ),
        );
        add(
            'exhaust',
            cyl(
                0.06,
                0.22,
                m.heat,
                'x',
                -front * 0.4,
                top * 0.2,
                -blockWidth / 2 - 0.2,
                { segments: 20 },
            ),
        );
        add(
            'exhaust',
            box(
                0.26,
                0.09,
                0.02,
                m.steel,
                -front * 0.4,
                top * 0.28,
                -blockWidth / 2 - 0.28,
            ),
        );
    }

    // A splash of hardware on the block so it reads as a casting, not a box.
    add(
        'block',
        bolts(
            m.steel,
            0.009,
            [
                [-front * 0.5, top * 0.6, blockWidth / 2 + 0.005],
                [front * 0.5, top * 0.6, blockWidth / 2 + 0.005],
                [-front * 0.5, -top * 0.6, blockWidth / 2 + 0.005],
                [front * 0.5, -top * 0.6, blockWidth / 2 + 0.005],
            ],
            'z',
        ),
    );
    add(
        'block',
        sphere(0.02, m.plastic, front * 0.3, top * 0.85, blockWidth / 2 + 0.01),
    );
}
