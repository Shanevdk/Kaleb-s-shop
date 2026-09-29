import * as THREE from 'three';
import type { EnginePartKey } from '@/lib/engine-parts';
import { roundPolygon } from '@/lib/three/curves';
import type { Materials } from '@/lib/three/materials';
import type { EngineBay } from '@/lib/three/road';
import { clonePatched } from '@/lib/three/shading';
import {
    bentTube,
    bolts,
    box,
    cyl,
    extrude,
    instanced,
    lathe,
    polygon,
    puck,
    rod,
    torus,
    tube,
    type Point,
    type Point3,
} from '@/lib/three/shapes';
import { softBox } from '@/lib/three/soft';

export type EngineInput = {
    cylinders: number | null;
    displacement: number | null;
    configuration: string | null;
    fuel: string | null;
    turbo: boolean | null;
};

export type PartMap = Map<EnginePartKey, THREE.Mesh[]>;

type Layout = 'inline' | 'vee' | 'flat';

/**
 * The real proportions of an engine, worked out from what is known about
 * it. The bore and stroke come from the swept volume of one cylinder and
 * a typical stroke-to-bore ratio (square for petrol, long-stroke for
 * diesel, short-stroke for bikes), and everything else scales off them.
 */
export type EngineGeometry = {
    cylinders: number;
    layout: Layout;
    banks: number;
    perBank: number;
    bore: number;
    stroke: number;
    pitch: number;
    deck: number;
    length: number;
    veeAngle: number;
    diesel: boolean;
    turbo: boolean;
    electric: boolean;
};

export function engineGeometry(
    input: EngineInput,
    style: EngineBay['style'] = 'car',
): EngineGeometry {
    const fuel = (input.fuel ?? '').toLowerCase();
    const electric = fuel.includes('electric') && !fuel.includes('hybrid');
    const small = style === 'small';
    const bike = style === 'bike';
    const fallbackCylinders = small
        ? 1
        : bike
          ? 2
          : style === 'outboard'
            ? 4
            : 4;
    const cylinders = Math.min(
        16,
        Math.max(1, Math.round(input.cylinders ?? fallbackCylinders)),
    );
    const configuration = (input.configuration ?? '').toLowerCase();
    const flat = /flat|boxer|opposed|horizontal/.test(configuration);
    const diesel = fuel.includes('diesel');
    const vee =
        !flat &&
        (configuration.startsWith('v') ||
            configuration.includes('vee') ||
            (configuration === '' &&
                (cylinders >= 8 ||
                    (cylinders === 6 &&
                        !diesel &&
                        !bike &&
                        style !== 'outboard'))) ||
            (small && cylinders === 2));
    const layout: Layout = flat
        ? 'flat'
        : vee && cylinders > 1
          ? 'vee'
          : 'inline';
    const perCylinder = THREE.MathUtils.clamp(
        (displacementLitres(input.displacement) ??
            cylinders * (small ? 0.3 : bike ? 0.35 : diesel ? 0.7 : 0.5)) /
            cylinders,
        0.04,
        2.5,
    );
    const ratio = bike ? 0.78 : small ? 0.85 : diesel ? 1.15 : 1.0;
    const bore = Math.cbrt((4 * perCylinder * 1e-3) / (Math.PI * ratio));
    const stroke = bore * ratio;
    const banks = layout === 'inline' ? 1 : 2;
    const perBank = Math.ceil(cylinders / banks);
    const pitch = bore + Math.max(0.009, bore * 0.11) + (diesel ? 0.012 : 0);
    const deck = stroke * 2.1 + bore * 0.32;
    const veeAngle =
        layout === 'flat'
            ? Math.PI
            : small
              ? Math.PI / 2
              : cylinders === 8 || cylinders === 10
                ? Math.PI / 2
                : bike
                  ? THREE.MathUtils.degToRad(75)
                  : Math.PI / 3;

    return {
        cylinders,
        layout,
        banks,
        perBank,
        bore,
        stroke,
        pitch,
        deck,
        length: perBank * pitch + 0.07 + (layout === 'vee' ? pitch * 0.3 : 0),
        veeAngle,
        diesel,
        turbo: input.turbo ?? (diesel && cylinders >= 3 && !small),
        electric,
    };
}

/**
 * The swept volume in litres. Anything too big to be litres was typed in
 * cubic centimetres, the way bike and small engines are usually quoted.
 */
export function displacementLitres(displacement: number | null): number | null {
    if (!displacement || !Number.isFinite(displacement) || displacement <= 0) {
        return null;
    }

    return displacement > 40 ? displacement / 1000 : displacement;
}

type Builder = {
    m: Materials;
    group: THREE.Group;
    add: <T extends THREE.Object3D>(
        key: EnginePartKey,
        object: T,
        parent?: THREE.Object3D,
    ) => T;
    g: EngineGeometry;
    /** Which way the vehicle's front is, in engine coordinates. */
    front: THREE.Vector3;
};

/**
 * Build an engine from its specs into the group, registering every mesh
 * against the part it belongs to so it can be hovered and clicked.
 *
 * +X is the timing end of the crank, +Y is up, and the crank sits at the
 * origin. Petrol and diesel, inline, vee and boxer, turbo or not, car,
 * motorcycle, small air-cooled and outboard engines are all built, and an
 * electric drive unit when the vehicle has no engine at all.
 */
export function buildEngine(
    input: EngineInput,
    m: Materials,
    group: THREE.Group,
    parts: PartMap,
    bay: EngineBay,
): EngineGeometry {
    const style = bay.style ?? 'car';
    const g = engineGeometry(input, style);
    const materials = new Map<string, THREE.Material>();

    const add = <T extends THREE.Object3D>(
        key: EnginePartKey,
        object: T,
        parent: THREE.Object3D = group,
    ): T => {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const base = child.material as THREE.Material;
                const id = `${key}:${base.uuid}`;
                let material = materials.get(id);

                if (!material) {
                    material = clonePatched(base);
                    materials.set(id, material);
                }

                child.material = material;
                child.userData.part = key;
                child.castShadow = true;
                child.receiveShadow = true;
                parts.set(key, [...(parts.get(key) ?? []), child]);
            }
        });
        parent.add(object);

        return object;
    };

    const front = new THREE.Vector3(
        Math.cos(bay.rotationY),
        0,
        Math.sin(bay.rotationY),
    );
    const builder: Builder = { m, group, add, g, front };

    if (g.electric) {
        buildDriveUnit(builder);
    } else if (style === 'bike') {
        buildBikeEngine(builder, bay.exhaust);
    } else if (style === 'small') {
        buildSmallEngine(builder, bay.vertical === true);
    } else if (style === 'outboard') {
        buildPowerhead(builder);
    } else {
        buildCarEngine(builder);
    }

    return g;
}

/* ------------------------------------------------------------------------ */
/* Shared pieces                                                            */
/* ------------------------------------------------------------------------ */

/**
 * A poly-V pulley: a disc with ribs round its rim and a hub, turned about
 * the X axis.
 */
function pulley(
    radius: number,
    width: number,
    material: THREE.Material,
    ribs = 6,
): THREE.Mesh {
    const profile: Point[] = [
        [0, -width / 2 - 0.004],
        [radius * 0.35, -width / 2 - 0.004],
        [radius * 0.4, -width / 2],
    ];
    const rib = width / ribs;

    for (let i = 0; i <= ribs; i++) {
        const y = -width / 2 + i * rib;
        profile.push([radius - 0.003, y]);

        if (i < ribs) {
            profile.push([radius, y + rib / 2]);
        }
    }

    profile.push(
        [radius * 0.4, width / 2],
        [radius * 0.35, width / 2 + 0.006],
        [0, width / 2 + 0.006],
    );

    return lathe(profile, material, 'x', 0, 0, 0, 40);
}

type Wheel = { y: number; z: number; r: number; back?: boolean };

/**
 * The run of a serpentine belt round its pulleys, in the YZ plane at the
 * given X. Pulleys the belt wraps with its back side (idlers, the
 * tensioner) take a negative radius, and the tangent between each pair
 * follows from that.
 */
function beltPath(wheels: Wheel[], x: number): Point3[] {
    const points: Point3[] = [];
    const count = wheels.length;
    const tangents: { from: THREE.Vector2; to: THREE.Vector2 }[] = [];

    for (let i = 0; i < count; i++) {
        const a = wheels[i];
        const b = wheels[(i + 1) % count];
        const ra = a.back ? -a.r : a.r;
        const rb = b.back ? -b.r : b.r;
        const ca = new THREE.Vector2(a.y, a.z);
        const cb = new THREE.Vector2(b.y, b.z);
        const d = cb.clone().sub(ca);
        const length = d.length();
        const u = d.clone().divideScalar(length);
        const v = new THREE.Vector2(-u.y, u.x);
        const k = Math.max(-0.999, Math.min(0.999, (ra - rb) / length));
        const n = u
            .clone()
            .multiplyScalar(k)
            .addScaledVector(v, -Math.sqrt(1 - k * k));
        tangents.push({
            from: ca.clone().addScaledVector(n, ra),
            to: cb.clone().addScaledVector(n, rb),
        });
    }

    for (let i = 0; i < count; i++) {
        const wheel = wheels[(i + 1) % count];
        const arrive = tangents[i].to;
        const leave = tangents[(i + 1) % count].from;
        const centre = new THREE.Vector2(wheel.y, wheel.z);
        let a0 = Math.atan2(arrive.y - centre.y, arrive.x - centre.x);
        let a1 = Math.atan2(leave.y - centre.y, leave.x - centre.x);
        points.push([x, arrive.x, arrive.y]);

        // Round the pulley the way the belt runs: one way on its face,
        // the other on its back.
        if (wheel.back) {
            while (a1 > a0) {
                a1 -= Math.PI * 2;
            }
        } else {
            while (a1 < a0) {
                a1 += Math.PI * 2;
            }
        }

        const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.2));

        for (let s = 1; s < steps; s++) {
            const a = a0 + ((a1 - a0) * s) / steps;
            points.push([
                x,
                centre.x + Math.cos(a) * wheel.r,
                centre.y + Math.sin(a) * wheel.r,
            ]);
        }

        points.push([x, leave.x, leave.y]);
        a0 = a1;
    }

    return points;
}

/**
 * A ribbed rubber hose with a clamp at each end.
 */
function hose(m: Materials, points: Point3[], radius: number): THREE.Group {
    const group = new THREE.Group();
    group.add(tube(points, radius, m.hose, { radial: 12 }));

    for (const end of [points[0], points[points.length - 1]]) {
        group.add(
            torus(radius + 0.002, 0.003, m.zinc, 'x', end[0], end[1], end[2], {
                radial: 6,
                tubular: 24,
            }),
        );
    }

    return group;
}

/**
 * The iconic yellow loop of an engine dipstick on its tube.
 */
function dipstick(m: Materials, from: Point3, to: Point3): THREE.Group {
    const group = new THREE.Group();
    group.add(
        bentTube(
            [
                from,
                [
                    (from[0] + to[0]) / 2,
                    (from[1] + to[1]) / 2 + 0.02,
                    (from[2] + to[2]) / 2,
                ],
                to,
            ],
            0.005,
            m.steel,
            0.05,
        ),
    );
    const handle = torus(
        0.018,
        0.006,
        m.yellow,
        'z',
        to[0],
        to[1] + 0.022,
        to[2],
        { radial: 8, tubular: 24 },
    );
    group.add(handle);

    return group;
}

/* ------------------------------------------------------------------------ */
/* Car and truck engines                                                    */
/* ------------------------------------------------------------------------ */

function buildCarEngine(b: Builder): void {
    const { m, g, add, front } = b;
    const iron = g.diesel ? m.castIron : m.castAluminium;
    const half = g.length / 2;
    const crankcaseWidth = g.stroke + 0.2;
    const crankDepth = g.stroke * 0.55 + 0.05;
    const boreWidth = g.bore + 0.085;
    const headHeight = g.diesel ? 0.125 : 0.11;
    const coverHeight = 0.07;
    const transverse = Math.abs(front.z) > 0.5;
    // Intake faces the firewall on a transverse engine, the right-hand side
    // on a longitudinal one; the exhaust faces the other way.
    const intakeSide =
        g.layout === 'inline' ? (transverse ? -Math.sign(front.z) : 1) : 1;

    // Bottom end: the crankcase, ribbed, with the main bearing girdle.
    const crankcase = softBox(
        g.length,
        crankDepth + 0.08,
        g.layout === 'inline' ? crankcaseWidth : crankcaseWidth + 0.08,
        iron,
        0,
        -crankDepth / 2 + 0.04,
        0,
        {
            divisions: [Math.max(2, g.perBank), 2, 2],
            crease: 1.2,
        },
    );
    add('block', crankcase);
    add(
        'block',
        instanced(
            new THREE.BoxGeometry(0.012, crankDepth * 0.7, 0.012),
            iron,
            Array.from({ length: g.perBank + 1 }, (_, i) => i).flatMap((i) =>
                [1, -1].map((side) => ({
                    x: -half + 0.035 + (i * (g.length - 0.07)) / g.perBank,
                    y: -crankDepth * 0.35,
                    z:
                        side *
                        ((g.layout === 'inline'
                            ? crankcaseWidth
                            : crankcaseWidth + 0.08) /
                            2 +
                            0.004),
                })),
            ),
        ),
    );

    // Each bank: the barrel section, head, cam cover, plugs or glow plugs.
    const angles =
        g.layout === 'inline' ? [0] : [g.veeAngle / 2, -g.veeAngle / 2];
    const banks: THREE.Group[] = [];

    angles.forEach((angle, index) => {
        const bank = new THREE.Group();
        bank.rotation.x = angle;
        const stagger =
            g.layout === 'vee' ? (index === 0 ? 1 : -1) * g.pitch * 0.15 : 0;
        bank.position.x = stagger;
        const count =
            index === angles.length - 1
                ? g.cylinders - g.perBank * (angles.length - 1)
                : g.perBank;
        const bankLength = count * g.pitch + 0.06;
        const bores = Array.from(
            { length: count },
            (_, i) => (i - (count - 1) / 2) * g.pitch,
        );
        const inner = g.layout === 'inline' ? intakeSide : index === 0 ? -1 : 1;
        const barrelHeight = g.deck - 0.05;
        const barrelBase = g.layout === 'flat' ? 0.07 : 0.05;

        // Barrels with a bulge round every bore.
        const barrel = softBox(
            bankLength,
            barrelHeight,
            boreWidth,
            iron,
            0,
            barrelBase + barrelHeight / 2,
            0,
            {
                divisions: [count * 2 + 1, 3, 2],
                crease: 1.3,
                shape: (p) => {
                    const phase = ((p.x - bores[0]) / g.pitch) * Math.PI;
                    const bump = Math.pow(Math.cos(phase), 2) * 0.1;
                    const fade = Math.sin(
                        Math.PI *
                            Math.min(
                                1,
                                Math.max(
                                    0,
                                    (p.y + barrelHeight / 2) / barrelHeight,
                                ),
                            ),
                    );
                    p.z *= 1 + bump * fade;
                },
            },
        );
        add('block', barrel, bank);

        // Core plugs down the side of the water jacket.
        for (const x of bores) {
            add(
                'block',
                puck(
                    0.016,
                    0.006,
                    m.brass,
                    'z',
                    x,
                    barrelBase + barrelHeight * 0.45,
                    -inner * (boreWidth / 2 + 0.004),
                ),
                bank,
            );
        }

        const headBase = barrelBase + barrelHeight;
        const head = softBox(
            bankLength - 0.01,
            headHeight,
            boreWidth + 0.03,
            m.castAluminium,
            0,
            headBase + headHeight / 2,
            0,
            {
                divisions: [count + 1, 1, 2],
                crease: 1.2,
            },
        );
        const cover = softBox(
            bankLength - 0.04,
            coverHeight,
            boreWidth - 0.01,
            g.diesel ? m.castAluminium : m.crinkle,
            0,
            headBase + headHeight + coverHeight / 2,
            0,
            {
                divisions: [count + 1, 1, 2],
                crease: 0.8,
                shape: (p) => {
                    p.y +=
                        Math.cos((p.z / (boreWidth / 2)) * (Math.PI / 2)) *
                        0.012;
                },
            },
        );
        const top = headBase + headHeight + coverHeight;
        const headParts = new THREE.Group();
        headParts.add(head, cover);

        // Stiffening ribs across the cover and its hold-down bolts.
        headParts.add(
            instanced(
                new THREE.BoxGeometry(0.008, 0.012, boreWidth * 0.6),
                g.diesel ? m.castAluminium : m.crinkle,
                bores
                    .map((x) => ({ x: x + g.pitch / 2, y: top + 0.004, z: 0 }))
                    .slice(0, -1),
            ),
        );
        headParts.add(
            bolts(
                m.zinc,
                0.006,
                [
                    ...bores,
                    bankLength / 2 - 0.04,
                    -bankLength / 2 + 0.04,
                ].flatMap((x) => [
                    [x, top - 0.012, boreWidth / 2 - 0.01] as Point3,
                    [x, top - 0.012, -boreWidth / 2 + 0.01] as Point3,
                ]),
            ),
        );

        // Oil filler cap on the first bank.
        if (index === 0) {
            headParts.add(
                puck(
                    0.03,
                    0.022,
                    g.diesel ? m.yellow : m.gloss,
                    'y',
                    -bankLength * 0.3,
                    top + 0.012,
                    0,
                ),
            );
        }

        if (g.diesel) {
            // Injectors up the middle of the head, glow plug wiring beside.
            for (const x of bores) {
                headParts.add(
                    cyl(0.011, 0.07, m.stainless, 'y', x, top + 0.03, 0),
                );
                headParts.add(
                    box(0.02, 0.018, 0.03, m.gloss, x, top + 0.07, 0, 0.005),
                );
            }
        } else {
            // Coil-on-plug packs with their connectors.
            for (const x of bores) {
                headParts.add(
                    softBox(0.045, 0.03, 0.06, m.gloss, x, top + 0.02, 0, {
                        crease: 0.6,
                    }),
                );
                headParts.add(
                    box(
                        0.018,
                        0.016,
                        0.022,
                        m.plastic,
                        x + 0.02,
                        top + 0.03,
                        0.02 * inner,
                        0.004,
                    ),
                );
            }

            // The loom from its connector at the end of the head along
            // every coil.
            headParts.add(
                tube(
                    [
                        [-bankLength / 2 + 0.005, top + 0.05, 0.03 * inner],
                        ...bores.map(
                            (x) =>
                                [x + 0.02, top + 0.042, 0.03 * inner] as Point3,
                        ),
                    ],
                    0.006,
                    m.wire,
                ),
            );
        }

        add('head', headParts, bank);

        // Exhaust ports on the outer side, intake on the inner side.
        const outer = -inner;
        const exhaust = new THREE.Group();
        const collectorX = g.turbo ? -bankLength * 0.05 : -bankLength * 0.35;
        const collector: Point3 = [
            collectorX,
            headBase - 0.05,
            outer * (boreWidth / 2 + 0.13),
        ];

        for (const x of bores) {
            exhaust.add(
                tube(
                    [
                        [
                            x,
                            headBase + headHeight * 0.45,
                            outer * (boreWidth / 2 + 0.012),
                        ],
                        [
                            x,
                            headBase + headHeight * 0.3,
                            outer * (boreWidth / 2 + 0.07),
                        ],
                        [
                            (x + collector[0]) / 2,
                            headBase - 0.02,
                            outer * (boreWidth / 2 + 0.11),
                        ],
                        collector,
                    ],
                    g.bore * 0.2,
                    g.diesel || g.layout !== 'inline' ? m.exhaust : m.stainless,
                    { radial: 12 },
                ),
            );
        }

        // A dimpled heat shield over the manifold, bolted to the head.
        exhaust.add(
            softBox(
                bankLength * 0.9,
                0.1,
                0.02,
                m.satin,
                0,
                headBase + headHeight * 0.1,
                outer * (boreWidth / 2 + 0.105),
                {
                    divisions: [3, 1, 1],
                    crease: 0.4,
                    shape: (p) => {
                        p.z += outer * Math.max(0, -p.y) * 0.4;
                    },
                },
            ),
        );
        add('exhaust', exhaust, bank);

        // Fuel: rail along the intake side with an injector per port, or
        // a diesel's common rail feeding steel lines.
        const fuel = new THREE.Group();
        const railZ = inner * (boreWidth / 2 + 0.03);

        if (g.diesel) {
            fuel.add(
                cyl(
                    0.013,
                    bankLength * 0.9,
                    m.steel,
                    'x',
                    0,
                    top + 0.02,
                    inner * (boreWidth / 2 + 0.06),
                ),
            );

            for (const x of bores) {
                fuel.add(
                    bentTube(
                        [
                            [
                                x * 0.9,
                                top + 0.02,
                                inner * (boreWidth / 2 + 0.06),
                            ],
                            [x, top + 0.05, inner * (boreWidth / 2)],
                            [x, top + 0.06, 0.012 * inner],
                        ],
                        0.0035,
                        m.stainless,
                        0.03,
                    ),
                );
            }
        } else {
            fuel.add(
                cyl(
                    0.01,
                    bankLength * 0.86,
                    m.stainless,
                    'x',
                    0,
                    headBase - 0.01,
                    railZ + inner * 0.02,
                ),
            );

            for (const x of bores) {
                const injector = cyl(
                    0.008,
                    0.05,
                    m.gloss,
                    'z',
                    x,
                    headBase - 0.005,
                    railZ,
                    { segments: 12 },
                );
                fuel.add(injector);
                fuel.add(
                    box(
                        0.014,
                        0.012,
                        0.018,
                        m.plastic,
                        x,
                        headBase + 0.012,
                        railZ + inner * 0.012,
                        0.003,
                    ),
                );
            }
        }

        add('fuel', fuel, bank);

        // Runners from each intake port for an inline engine.
        if (g.layout === 'inline') {
            const runners = new THREE.Group();

            for (const x of bores) {
                runners.add(
                    tube(
                        [
                            [
                                x,
                                headBase + headHeight * 0.4,
                                inner * (boreWidth / 2 + 0.01),
                            ],
                            [
                                x,
                                headBase + headHeight * 0.55,
                                inner * (boreWidth / 2 + 0.08),
                            ],
                            [
                                x * 0.92,
                                top + 0.02,
                                inner * (boreWidth / 2 + 0.15),
                            ],
                            [
                                x * 0.85,
                                top + 0.06,
                                inner * (boreWidth / 2 + 0.2),
                            ],
                        ],
                        g.bore * 0.24,
                        g.diesel ? m.castAluminium : m.engineCover,
                        { radial: 14 },
                    ),
                );
            }

            runners.add(
                softBox(
                    bankLength * 0.88,
                    0.1,
                    0.13,
                    g.diesel ? m.castAluminium : m.engineCover,
                    0,
                    top + 0.06,
                    inner * (boreWidth / 2 + 0.24),
                    {
                        divisions: [3, 1, 1],
                        crease: 0.5,
                    },
                ),
            );
            // Throttle body at the front of the plenum.
            runners.add(
                puck(
                    0.042,
                    0.06,
                    m.castAluminium,
                    'x',
                    bankLength * 0.47,
                    top + 0.06,
                    inner * (boreWidth / 2 + 0.24),
                ),
            );
            runners.add(
                torus(
                    0.036,
                    0.004,
                    m.satin,
                    'x',
                    bankLength * 0.5,
                    top + 0.06,
                    inner * (boreWidth / 2 + 0.24),
                    { radial: 6, tubular: 24 },
                ),
            );
            add('intake', runners, bank);
        }

        b.group.add(bank);
        banks.push(bank);
    });

    // Vee and boxer engines take their air from a plenum between or above
    // the banks.
    if (g.layout !== 'inline') {
        const intake = new THREE.Group();
        const valleyY =
            g.layout === 'flat'
                ? g.deck * 0.25 + 0.12
                : g.deck * Math.cos(g.veeAngle / 2) + headHeight * 0.4;
        intake.add(
            softBox(
                g.length * 0.85,
                0.14,
                g.layout === 'flat' ? 0.26 : 0.22,
                g.diesel ? m.castAluminium : m.engineCover,
                0,
                valleyY + 0.08,
                0,
                {
                    divisions: [3, 1, 2],
                    crease: 0.6,
                },
            ),
        );
        const bankSin = Math.sin(g.veeAngle / 2);
        const bankCos = Math.cos(g.veeAngle / 2);

        for (let i = 0; i < g.perBank; i++) {
            const x = (i - (g.perBank - 1) / 2) * g.pitch;

            for (const side of [1, -1]) {
                const portR = g.deck + headHeight * 0.5;
                const port: Point3 = [
                    x,
                    portR * bankCos,
                    side * portR * bankSin,
                ];
                const inward = new THREE.Vector3(
                    0,
                    bankSin,
                    -side * bankCos,
                ).multiplyScalar(boreWidth / 2 + 0.01);
                intake.add(
                    tube(
                        [
                            [port[0], port[1] + inward.y, port[2] + inward.z],
                            [x, valleyY + 0.02, side * 0.12],
                            [x * 0.9, valleyY + 0.1, side * 0.02],
                        ],
                        g.bore * 0.22,
                        g.diesel ? m.castAluminium : m.engineCover,
                        { radial: 12 },
                    ),
                );
            }
        }

        intake.add(
            puck(
                0.045,
                0.06,
                m.castAluminium,
                'x',
                g.length * 0.46,
                valleyY + 0.08,
                0,
            ),
        );
        add('intake', intake);
    }

    const coverTop =
        g.layout === 'inline'
            ? g.deck + headHeight + coverHeight
            : g.deck * Math.cos(g.veeAngle / 2) + headHeight + coverHeight;
    const engineWidth =
        g.layout === 'inline'
            ? boreWidth + 0.5
            : 2 * (g.deck + headHeight) * Math.sin(g.veeAngle / 2) + boreWidth;

    // Timing cover over the front of the block and heads.
    add(
        'block',
        softBox(
            0.045,
            Math.max(coverTop, g.deck) + crankDepth * 0.4,
            Math.min(
                engineWidth * 0.7,
                boreWidth + (g.layout === 'inline' ? 0.06 : 0.25),
            ),
            m.castAluminium,
            half + 0.02,
            (coverTop - crankDepth * 0.4) / 2,
            0,
            {
                divisions: [1, 3, 2],
                crease: 0.8,
            },
        ),
    );

    // Oil sump: a pressed pan with a deeper well, fins and a drain plug.
    const sump = new THREE.Group();
    const sumpTop = -crankDepth + 0.04;
    const sumpWidth =
        g.layout === 'inline' ? crankcaseWidth - 0.02 : crankcaseWidth + 0.04;
    sump.add(
        softBox(
            g.length - 0.02,
            0.07,
            sumpWidth,
            m.castAluminium,
            0,
            sumpTop - 0.035,
            0,
            { crease: 1, divisions: [2, 1, 2] },
        ),
    );
    sump.add(
        softBox(
            g.length * 0.55,
            0.12,
            sumpWidth * 0.8,
            m.castAluminium,
            -g.length * 0.18,
            sumpTop - 0.12,
            0,
            { crease: 0.8, divisions: [2, 1, 2] },
        ),
    );
    sump.add(
        instanced(
            new THREE.BoxGeometry(g.length * 0.5, 0.01, 0.006),
            m.castAluminium,
            [-0.3, -0.1, 0.1, 0.3].map((z) => ({
                x: -g.length * 0.18,
                y: sumpTop - 0.18,
                z: z * sumpWidth * 0.8,
            })),
        ),
    );
    sump.add(
        bolts(m.zinc, 0.009, [[-g.length * 0.1, sumpTop - 0.185, 0.03]], '-y'),
    );
    sump.add(
        dipstick(
            m,
            [half - 0.1, 0.02, intakeSide * (crankcaseWidth / 2 + 0.01)],
            [half - 0.06, coverTop + 0.06, intakeSide * (boreWidth / 2 + 0.06)],
        ),
    );
    add('sump', sump);

    // Oil filter on the side of the block.
    const filter = new THREE.Group();
    const filterAt: Point3 = [
        g.length * 0.15,
        -crankDepth * 0.3,
        -intakeSide * (crankcaseWidth / 2 + 0.07),
    ];
    filter.add(
        puck(
            0.045,
            0.028,
            m.castAluminium,
            'z',
            filterAt[0],
            filterAt[1],
            filterAt[2] + intakeSide * 0.05,
        ),
    );
    const canister = cyl(
        0.04,
        0.09,
        m.blue,
        'z',
        filterAt[0],
        filterAt[1],
        filterAt[2] - intakeSide * 0.01,
        { segments: 28 },
    );
    filter.add(canister);
    filter.add(
        instanced(
            new THREE.BoxGeometry(0.004, 0.01, 0.02),
            m.blue,
            Array.from({ length: 16 }, (_, i) => {
                const a = (i / 16) * Math.PI * 2;

                return {
                    x: filterAt[0] + Math.cos(a) * 0.041,
                    y: filterAt[1] + Math.sin(a) * 0.041,
                    z: filterAt[2] - intakeSide * 0.045,
                    rz: a,
                };
            }),
        ),
    );
    add('filter', filter);

    // Front accessory drive: crank damper, water pump, alternator, air
    // conditioning compressor, tensioner and idler, with the belt round
    // them all.
    const beltX = half + 0.07;
    const alternatorSide = intakeSide;
    const wheels: (Wheel & { key: EnginePartKey })[] = [
        { y: 0, z: 0, r: 0.078, key: 'belt' },
        {
            y: -0.02,
            z: -alternatorSide * (crankcaseWidth / 2 + 0.07),
            r: 0.058,
            key: 'belt',
        },
        {
            y: g.deck * 0.35,
            z: -alternatorSide * (boreWidth / 2 + 0.02),
            r: 0.034,
            back: true,
            key: 'belt',
        },
        { y: g.deck * 0.62, z: -alternatorSide * 0.02, r: 0.056, key: 'belt' },
        {
            y: g.deck * 0.98,
            z: alternatorSide * (boreWidth / 2 + 0.07),
            r: 0.03,
            key: 'alternator',
        },
        {
            y: g.deck * 0.45,
            z: alternatorSide * (boreWidth / 2 - 0.01),
            r: 0.034,
            back: true,
            key: 'belt',
        },
    ];

    // Walk them round in order so the belt closes the right way.
    const ordered = [...wheels].sort(
        (a, c) =>
            Math.atan2(a.z - 0.0, a.y - g.deck * 0.4) -
            Math.atan2(c.z - 0.0, c.y - g.deck * 0.4),
    );
    const beltGroup = new THREE.Group();

    for (const wheel of wheels) {
        if (wheel.key === 'belt') {
            const p = pulley(wheel.r, 0.024, wheel.back ? m.steel : m.steel);
            p.position.set(beltX, wheel.y, wheel.z);
            beltGroup.add(p);
        }
    }

    // Harmonic damper's rubber ring on the crank pulley.
    beltGroup.add(
        torus(0.05, 0.006, m.rubber, 'x', beltX + 0.01, 0, 0, {
            radial: 6,
            tubular: 32,
        }),
    );
    beltGroup.add(puck(0.018, 0.03, m.zinc, 'x', beltX + 0.02, 0, 0));

    // Tensioner arm and its spring housing.
    const tensioner = wheels[5];
    beltGroup.add(
        rod(
            [beltX - 0.02, tensioner.y, tensioner.z],
            [
                beltX - 0.02,
                tensioner.y - 0.08,
                tensioner.z - alternatorSide * 0.03,
            ],
            0.012,
            m.castAluminium,
        ),
    );
    beltGroup.add(
        puck(
            0.03,
            0.03,
            m.castAluminium,
            'x',
            beltX - 0.035,
            tensioner.y - 0.08,
            tensioner.z - alternatorSide * 0.03,
        ),
    );

    // Water pump body and the air conditioning compressor.
    beltGroup.add(
        puck(
            0.05,
            0.05,
            m.castAluminium,
            'x',
            beltX - 0.045,
            wheels[3].y,
            wheels[3].z,
        ),
    );
    const compressor = new THREE.Group();
    compressor.position.set(beltX - 0.1, wheels[1].y, wheels[1].z);
    compressor.add(
        cyl(0.062, 0.16, m.castAluminium, 'x', -0.03, 0, 0, { segments: 28 }),
    );
    compressor.add(puck(0.022, 0.04, m.castAluminium, 'y', -0.04, 0.07, 0));
    compressor.add(
        tube(
            [
                [-0.04, 0.09, 0],
                [-0.04, 0.16, 0.02],
                [0.02, 0.22, 0.05],
            ],
            0.009,
            m.hose,
        ),
    );
    beltGroup.add(compressor);

    const path = beltPath(ordered, beltX);
    beltGroup.add(
        tube(path, 0.006, m.belt, {
            closed: true,
            segments: path.length * 3,
            radial: 6,
            tension: 0.2,
        }),
    );
    beltGroup.add(
        instanced(
            new THREE.BoxGeometry(0.02, 0.003, 0.003),
            m.belt,
            path
                .filter((_, i) => i % 2 === 0)
                .map(([x, y, z]) => ({
                    x: x - 0.002,
                    y: y * 0.995,
                    z: z * 0.995,
                })),
        ),
    );
    add('belt', beltGroup);

    // Alternator: finned case, copper windings through the vents, pulley.
    const alternatorWheel = wheels[4];
    const alternator = new THREE.Group();
    alternator.position.set(beltX, alternatorWheel.y, alternatorWheel.z);
    alternator.add(pulley(0.03, 0.024, m.steel));
    alternator.add(puck(0.07, 0.12, m.castAluminium, 'x', -0.09, 0, 0));
    alternator.add(puck(0.058, 0.04, m.copper, 'x', -0.09, 0, 0));
    alternator.add(
        instanced(
            new THREE.BoxGeometry(0.05, 0.014, 0.012),
            m.castAluminium,
            Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;

                return {
                    x: -0.09,
                    y: Math.cos(a) * 0.068,
                    z: Math.sin(a) * 0.068,
                    rx: -a,
                };
            }),
        ),
    );
    alternator.add(puck(0.05, 0.03, m.plastic, 'x', -0.17, 0, 0));
    alternator.add(box(0.02, 0.03, 0.03, m.gloss, -0.19, 0.03, 0.03, 0.005));
    add('alternator', alternator);

    // Flywheel and bell housing at the back, with the gearbox behind it.
    const bellRadius = Math.max(0.19, crankDepth + 0.05);
    const bell = new THREE.Group();
    bell.add(
        lathe(
            [
                [0.05, 0],
                [bellRadius * 0.9, 0],
                [bellRadius, 0.03],
                [bellRadius * 0.98, 0.12],
                [bellRadius * 0.7, 0.24],
                [bellRadius * 0.5, 0.36],
                [0.08, 0.4],
                [0, 0.4],
            ],
            iron === m.castIron ? m.castIron : m.castAluminium,
            'x',
            -half - 0.005,
            -0.02,
            0,
            40,
        ),
    );
    // Turned round so the bell opens towards the engine.
    bell.children[0].rotation.z = Math.PI / 2;
    bell.add(
        bolts(
            m.zinc,
            0.008,
            Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;

                return [
                    -half - 0.035,
                    -0.02 + Math.cos(a) * bellRadius * 0.92,
                    Math.sin(a) * bellRadius * 0.92,
                ] as Point3;
            }),
            '-x',
        ),
    );
    bell.add(
        softBox(
            0.3,
            bellRadius * 1.1,
            bellRadius * 1.1,
            m.castAluminium,
            -half - 0.5,
            -0.04,
            0,
            {
                divisions: [2, 2, 2],
                crease: 0.8,
            },
        ),
    );
    add('flywheel', bell);

    // Starter motor bolted to the bell housing, low on the intake side.
    const starter = new THREE.Group();
    starter.position.set(
        -half - 0.1,
        -crankDepth * 0.55,
        intakeSide * (crankcaseWidth / 2 + 0.05),
    );
    starter.add(cyl(0.042, 0.16, m.gloss, 'x', 0.08, 0, 0, { segments: 24 }));
    starter.add(cyl(0.028, 0.1, m.zinc, 'x', 0.07, 0.06, 0, { segments: 20 }));
    starter.add(puck(0.045, 0.04, m.castAluminium, 'x', -0.02, 0, 0));
    starter.add(
        tube(
            [
                [0.1, 0.09, 0],
                [0.12, 0.2, 0.05],
                [0.05, 0.3, 0.1],
            ],
            0.007,
            m.wire,
        ),
    );
    add('starter', starter);

    // Air box on the intake side with its duct and filter lid clips.
    const air = new THREE.Group();
    const boxAt = new THREE.Vector3(
        -g.length * 0.1,
        coverTop - 0.08,
        intakeSide * (boreWidth / 2 + 0.4),
    );

    if (g.layout !== 'inline') {
        boxAt.set(g.length * 0.2, coverTop + 0.06, 0.45);
    }

    air.add(
        softBox(0.3, 0.12, 0.22, m.engineCover, boxAt.x, boxAt.y, boxAt.z, {
            crease: 0.8,
            divisions: [2, 1, 2],
        }),
    );
    air.add(
        softBox(
            0.28,
            0.035,
            0.2,
            m.engineCover,
            boxAt.x,
            boxAt.y + 0.07,
            boxAt.z,
            { crease: 0.8 },
        ),
    );
    air.add(
        instanced(
            new THREE.BoxGeometry(0.02, 0.05, 0.01),
            m.zinc,
            [-0.1, 0.1].flatMap((x) =>
                [1, -1].map((s) => ({
                    x: boxAt.x + x,
                    y: boxAt.y + 0.07,
                    z: boxAt.z + s * 0.13,
                })),
            ),
        ),
    );
    air.add(
        softBox(
            0.1,
            0.07,
            0.08,
            m.engineCover,
            boxAt.x + 0.23,
            boxAt.y - 0.03,
            boxAt.z,
            { crease: 0.6 },
        ),
    );

    if (!g.turbo) {
        const target: Point3 =
            g.layout === 'inline'
                ? [
                      g.length * 0.5,
                      coverTop - 0.01,
                      intakeSide * (boreWidth / 2 + 0.24),
                  ]
                : [g.length * 0.5, coverTop + 0.08, 0];
        air.add(
            hose(
                m,
                [
                    [boxAt.x + 0.15, boxAt.y, boxAt.z],
                    [
                        g.length * 0.62,
                        boxAt.y + 0.02,
                        (boxAt.z + target[2]) / 2,
                    ],
                    target,
                ],
                0.036,
            ),
        );
    }

    add('airbox', air);

    // Turbocharger hung off the exhaust side, with its charge pipes.
    if (g.turbo) {
        const turbo = new THREE.Group();
        const outer = g.layout === 'inline' ? -intakeSide : 1;
        const at = new THREE.Vector3(
            -g.length * 0.05,
            g.deck * 0.4,
            outer * (boreWidth / 2 + 0.25),
        );

        if (g.layout !== 'inline') {
            at.set(-half + 0.05, coverTop + 0.08, 0);
        }

        turbo.position.copy(at);
        // Turbine housing (cast iron) and compressor housing (aluminium).
        turbo.add(
            torus(0.055, 0.035, m.exhaust, 'x', -0.05, 0, 0, {
                radial: 12,
                tubular: 32,
            }),
        );
        turbo.add(puck(0.05, 0.07, m.exhaust, 'x', -0.05, 0, 0));
        turbo.add(puck(0.035, 0.07, m.steel, 'x', 0.01, 0, 0));
        turbo.add(
            torus(0.06, 0.038, m.castAluminium, 'x', 0.08, 0, 0, {
                radial: 12,
                tubular: 32,
            }),
        );
        turbo.add(puck(0.058, 0.06, m.castAluminium, 'x', 0.08, 0, 0));
        turbo.add(
            cyl(0.035, 0.07, m.castAluminium, 'x', 0.15, 0, 0, { open: false }),
        );
        turbo.add(cyl(0.028, 0.08, m.castAluminium, 'y', 0.08, 0.08, 0.02));
        // Wastegate actuator and its rod.
        turbo.add(puck(0.03, 0.03, m.gloss, 'z', 0.08, -0.08, 0.06));
        turbo.add(
            rod([0.08, -0.08, 0.06], [-0.04, -0.06, 0.06], 0.004, m.steel),
        );
        turbo.add(
            tube(
                [
                    [0.0, 0.05, 0.02],
                    [0.02, 0.15, 0.05],
                    [0.1, 0.25, 0.02],
                ],
                0.004,
                m.steel,
            ),
        );
        add('turbo', turbo);

        const pipes = new THREE.Group();
        pipes.add(
            hose(
                m,
                [
                    [boxAt.x + 0.15, boxAt.y, boxAt.z],
                    [g.length * 0.5, boxAt.y - 0.05, (boxAt.z + at.z) / 2],
                    [at.x + 0.19, at.y, at.z],
                ],
                0.038,
            ),
        );
        pipes.add(
            tube(
                [
                    [at.x + 0.08, at.y + 0.12, at.z],
                    [at.x + 0.2, at.y + 0.2, at.z * 0.7],
                    [g.length * 0.55, coverTop + 0.02, at.z * 0.3],
                    [g.length * 0.5, coverTop, 0],
                ],
                0.028,
                m.satin,
            ),
        );
        add('turbo', pipes);
    }

    // Radiator and fan out ahead of the engine, with hoses and a coolant
    // bottle.
    buildRadiator(b, g.length, coverTop, crankDepth, transverse);
}

function buildRadiator(
    b: Builder,
    length: number,
    top: number,
    bottom: number,
    transverse: boolean,
): void {
    const { m, add, front, g } = b;
    const radiator = new THREE.Group();
    const width = transverse ? Math.max(0.6, length + 0.2) : 0.62;
    const height = Math.max(0.42, top + bottom * 0.4);
    const distance = transverse ? 0.34 : length / 2 + 0.24;
    const centre = front.clone().multiplyScalar(distance);
    centre.y = (top - bottom) / 2 + 0.04;
    radiator.position.copy(centre);
    radiator.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), front);

    radiator.add(
        box(0.035, height - 0.1, width - 0.1, m.castIron, 0, 0, 0, 0.004),
    );
    radiator.add(
        instanced(
            new THREE.BoxGeometry(0.036, height - 0.12, 0.0015),
            m.satin,
            Array.from(
                { length: Math.floor((width - 0.14) / 0.008) },
                (_, i) => ({
                    x: 0.001,
                    y: 0,
                    z: -(width - 0.14) / 2 + i * 0.008,
                }),
            ),
        ),
    );
    radiator.add(
        box(0.05, 0.06, width, m.engineCover, 0, height / 2 - 0.03, 0, 0.012),
    );
    radiator.add(
        box(0.05, 0.06, width, m.engineCover, 0, -height / 2 + 0.03, 0, 0.012),
    );
    radiator.add(
        cyl(0.022, 0.05, m.engineCover, 'y', 0, height / 2 + 0.02, width * 0.3),
    );

    // Electric fan in a shroud behind the core, facing the engine.
    radiator.add(
        box(0.04, height - 0.06, width - 0.06, m.plastic, -0.05, 0, 0, 0.012),
    );
    const fanRadius = Math.min(height, width) * 0.4;
    radiator.add(puck(0.05, 0.06, m.gloss, 'x', -0.09, 0, 0));
    radiator.add(
        instanced(
            new THREE.BoxGeometry(0.012, fanRadius * 0.85, 0.07),
            m.plastic,
            Array.from({ length: 7 }, (_, i) => {
                const a = (i / 7) * Math.PI * 2;

                return {
                    x: -0.08,
                    y: Math.cos(a) * fanRadius * 0.5,
                    z: Math.sin(a) * fanRadius * 0.5,
                    rx: -a,
                    ry: 0.4,
                };
            }),
        ),
    );
    radiator.add(
        torus(fanRadius, 0.01, m.plastic, 'x', -0.08, 0, 0, {
            radial: 6,
            tubular: 48,
        }),
    );
    add('radiator', radiator);

    // Hoses from the thermostat and water pump.
    const toEngine = (point: THREE.Vector3) =>
        point.applyQuaternion(radiator.quaternion).add(radiator.position);
    const topTank = toEngine(
        new THREE.Vector3(-0.02, height / 2 - 0.03, -width * 0.3),
    );
    const bottomTank = toEngine(
        new THREE.Vector3(-0.02, -height / 2 + 0.05, width * 0.3),
    );
    const hoses = new THREE.Group();
    hoses.add(
        hose(
            m,
            [
                [topTank.x, topTank.y, topTank.z],
                [topTank.x * 0.6, top * 0.9, topTank.z * 0.6],
                [front.x * length * 0.3, g.deck * 0.95, front.z * 0.12],
            ],
            0.022,
        ),
    );
    hoses.add(
        hose(
            m,
            [
                [bottomTank.x, bottomTank.y, bottomTank.z],
                [bottomTank.x * 0.6, 0.0, bottomTank.z * 0.5],
                [front.x * (length / 2 + 0.03), g.deck * 0.5, front.z * 0.2],
            ],
            0.022,
        ),
    );

    // Coolant expansion bottle, translucent with pink coolant inside.
    const bottle = toEngine(
        new THREE.Vector3(-0.15, height / 2 - 0.05, width / 2 - 0.05),
    );
    hoses.add(
        softBox(
            0.12,
            0.14,
            0.1,
            m.translucent,
            bottle.x,
            bottle.y + 0.06,
            bottle.z,
            { crease: 0.6 },
        ),
    );
    const coolant = new THREE.MeshStandardMaterial({
        color: 0xe0467c,
        roughness: 0.3,
        transparent: true,
        opacity: 0.8,
    });
    hoses.add(
        box(
            0.1,
            0.07,
            0.08,
            coolant,
            bottle.x,
            bottle.y + 0.03,
            bottle.z,
            0.01,
        ),
    );
    hoses.add(
        puck(0.025, 0.02, m.gloss, 'y', bottle.x, bottle.y + 0.14, bottle.z),
    );
    add('radiator', hoses);
}

/* ------------------------------------------------------------------------ */
/* Motorcycle and quad engines                                              */
/* ------------------------------------------------------------------------ */

/**
 * Whether a bike engine is air-cooled: big vee twins, boxers and little
 * singles wear finned barrels, everything else a water jacket and a
 * radiator.
 */
function airCooledBike(g: EngineGeometry): boolean {
    const swept = (Math.PI / 4) * g.bore * g.bore * g.stroke;

    return (
        g.layout === 'flat' ||
        (g.layout === 'vee' && g.cylinders <= 2 && swept > 0.00055) ||
        (g.cylinders === 1 && swept < 0.00026)
    );
}

/**
 * A cooling fin: a thin plate with rounded corners, lying flat.
 */
function finGeometry(
    width: number,
    depth: number,
    thickness: number,
    radius: number,
): THREE.BufferGeometry {
    const w = width / 2;
    const d = depth / 2;
    const r = Math.min(radius, w * 0.9, d * 0.9);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 3,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -thickness / 2, 0);

    return geometry;
}

/**
 * A domed cover turned about an axis and bulging out along it, one way or
 * the other: alternator, clutch and timing covers.
 */
function dome(
    radius: number,
    bulge: number,
    material: THREE.Material,
    axis: 'x' | 'z',
    outward: 1 | -1,
    at: Point3,
): THREE.Mesh {
    const cover = lathe(
        [
            [radius, 0],
            [radius, bulge * 0.25],
            [radius * 0.94, bulge * 0.62],
            [radius * 0.78, bulge * 0.88],
            [radius * 0.45, bulge * 0.99],
            [0, bulge],
        ],
        material,
        axis,
        at[0],
        at[1],
        at[2],
        40,
    );

    if (outward < 0) {
        if (axis === 'x') {
            cover.rotation.y = Math.PI;
        } else {
            cover.rotation.x = -Math.PI / 2;
        }
    }

    return cover;
}

/**
 * Evenly spaced points round a circle, as pairs about its centre: bolt
 * rings on covers.
 */
function circle(count: number, radius: number, a = 0, b = 0): Point[] {
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.PI / count;

        return [a + Math.cos(angle) * radius, b + Math.sin(angle) * radius];
    });
}

/**
 * A side-view outline (z forward, y up) rounded off and extruded across
 * the engine along X, centred on x: the halves of a bike's cases.
 */
function sideExtrusion(
    outline: Point[],
    width: number,
    material: THREE.Material,
    radius: number,
    bevel: number,
    x = 0,
): THREE.Mesh {
    const rounded = roundPolygon(
        outline.map(([z, y]) => [-z, y] as [number, number]),
        radius,
        5,
    );

    return extrude(polygon(rounded), width, material, { axis: 'x', bevel, x });
}

/**
 * An exhaust header along the points, its steel coloured by heat the way
 * real ones go: straw and blue by the port, fading to bare metal.
 */
function heatedPipe(
    points: Point3[],
    radius: number,
    material: THREE.Material,
): THREE.Mesh {
    const pipe = tube(points, radius, material, {
        radial: 14,
        segments: Math.max(48, points.length * 16),
    });
    const geometry = pipe.geometry as THREE.TubeGeometry;
    const { tubularSegments, radialSegments } = geometry.parameters;
    const straw = new THREE.Color(1, 0.8, 0.52);
    const blue = new THREE.Color(0.62, 0.62, 0.98);
    const bare = new THREE.Color(1, 1, 1);
    const colour = new THREE.Color();
    const colours = new Float32Array(
        (tubularSegments + 1) * (radialSegments + 1) * 3,
    );
    let offset = 0;

    for (let i = 0; i <= tubularSegments; i++) {
        const t = i / tubularSegments;

        if (t < 0.1) {
            colour.copy(straw).lerp(blue, t / 0.1);
        } else {
            colour.copy(blue).lerp(bare, Math.min(1, (t - 0.1) / 0.28));
        }

        for (let j = 0; j <= radialSegments; j++) {
            colours[offset++] = colour.r;
            colours[offset++] = colour.g;
            colours[offset++] = colour.b;
        }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

    return pipe;
}

/**
 * The run of one header from its port to where the machine's own exhaust
 * takes over: down the front of the cases and back under the sump when it
 * leaves forwards, round the right-hand side when it leaves backwards.
 */
function headerPath(
    port: THREE.Vector3,
    direction: THREE.Vector3,
    target: THREE.Vector3,
    caseFront: number,
    bottom: number,
    rightSide: number,
): Point3[] {
    const points = [
        port.clone().addScaledVector(direction, -0.008),
        port.clone().addScaledVector(direction, 0.03),
        port
            .clone()
            .addScaledVector(direction, 0.065)
            .add(new THREE.Vector3(0, -0.045, 0)),
    ];
    const bend = points[2];

    if (direction.z >= 0) {
        points.push(
            new THREE.Vector3(
                port.x * 0.9,
                (bend.y + Math.max(bottom, target.y)) / 2,
                Math.max(bend.z, caseFront + 0.045),
            ),
        );

        if (target.z < caseFront * 0.5) {
            points.push(
                new THREE.Vector3(
                    port.x * 0.55,
                    bottom - 0.035,
                    caseFront * 0.55,
                ),
            );
            points.push(
                new THREE.Vector3(
                    target.x + port.x * 0.2,
                    target.y,
                    target.z + 0.07,
                ),
            );
        }
    } else {
        points.push(new THREE.Vector3(rightSide, bend.y - 0.06, bend.z - 0.02));
        points.push(
            new THREE.Vector3(rightSide, target.y + 0.03, target.z - 0.03),
        );
    }

    points.push(target.clone());

    return points.map((point) => point.toArray() as Point3);
}

/**
 * A motorcycle or quad engine with its gearbox in the same cases, built
 * from its bore and stroke: an inline engine leaning forward, a vee twin
 * with a cylinder fore and aft, or a boxer with its heads out in the wind.
 * The crank runs along X with +X on the machine's left, where the
 * alternator lives; the clutch is on the right and the gearbox's output
 * sprocket sits behind the crank on the left. Liquid-cooled engines carry
 * a radiator and throttle bodies under an airbox; big air-cooled twins
 * wear deep fins and chrome. The headers run from the ports to where the
 * machine's own exhaust takes over.
 */
function buildBikeEngine(
    b: Builder,
    exhaustTo: THREE.Vector3 | undefined,
): void {
    const { m, g, add } = b;
    const air = airCooledBike(g);
    const flat = g.layout === 'flat';
    const vee = g.layout === 'vee';
    const cruiser = air && vee;
    const chamber = g.stroke / 2 + 0.05;
    const caseWidth = flat
        ? 0.24
        : Math.max(0.18, (vee ? g.pitch + 0.02 : g.perBank * g.pitch) + 0.035);
    const sumpY = -chamber - 0.07;
    const caseMetal = cruiser ? m.polished : m.castAluminium;
    // Covers cast in magnesium: a darker, duller metal than the cases.
    const magnesium = clonePatched(m.castAluminium);
    magnesium.color.set(0x5d6166);
    const coverMetal = cruiser ? m.chrome : air ? m.castAluminium : magnesium;
    const finMetal = cruiser ? m.engineCover : m.castAluminium;
    const bolt = m.steel;

    // Each bank in its own frame: bores up +Y spaced along X, exhaust out
    // of the +Z face, intake out of the -Z face.
    const banks: { frame: THREE.Group; bores: number[] }[] = [];
    const addBank = (count: number, rotation: Point3, offset: Point3): void => {
        if (count < 1) {
            return;
        }

        const frame = new THREE.Group();
        frame.rotation.set(rotation[0], rotation[1], rotation[2]);
        frame.position.set(offset[0], offset[1], offset[2]);
        frame.updateMatrix();
        b.group.add(frame);
        banks.push({
            frame,
            bores: Array.from(
                { length: count },
                (_, i) => (i - (count - 1) / 2) * g.pitch,
            ),
        });
    };

    if (flat) {
        addBank(g.perBank, [0, 0, -Math.PI / 2], [0, 0, 0.02]);
        addBank(g.cylinders - g.perBank, [0, 0, Math.PI / 2], [0, 0, -0.02]);
    } else if (vee) {
        const angle = cruiser ? THREE.MathUtils.degToRad(45) : g.veeAngle;
        addBank(g.perBank, [angle / 2 + 0.12, 0, 0], [0.018, 0, 0]);
        // The rear cylinder turned round so its exhaust leaves backwards.
        addBank(
            g.cylinders - g.perBank,
            [-(angle / 2 - 0.12), Math.PI, 0],
            [-0.018, 0, 0],
        );
    } else {
        addBank(g.cylinders, [g.cylinders === 1 ? 0.3 : 0.45, 0, 0], [0, 0, 0]);
    }

    const blockBase = flat ? caseWidth / 2 - 0.012 : chamber * 0.78;
    const barrelTop = Math.max(g.deck, blockBase + g.stroke * 1.15 + 0.03);
    const headHeight = 0.045 + g.bore * 0.35;
    const coverHeight = air ? 0.03 : 0.036;
    const depth = g.bore + (air ? 0.07 : 0.058);
    const top = barrelTop + headHeight;
    const exhaustPorts: { at: THREE.Vector3; direction: THREE.Vector3 }[] = [];
    const intakeEnds: THREE.Vector3[] = [];
    const inEngine = (
        frame: THREE.Object3D,
        x: number,
        y: number,
        z: number,
    ): THREE.Vector3 => new THREE.Vector3(x, y, z).applyMatrix4(frame.matrix);
    const intakeDirection = new THREE.Vector3(0, 0.6, -1).normalize();
    const intakeUp = new THREE.Vector3(0, 1, 0.6).normalize();

    for (const { frame, bores } of banks) {
        const width = bores.length * g.pitch + (air ? 0.022 : 0.03);
        const height = barrelTop - blockBase;

        if (air) {
            // Liners under a stack of fins that grow towards the head.
            const fins = new THREE.Group();

            for (const x of bores) {
                fins.add(
                    cyl(
                        g.bore / 2 + 0.01,
                        height,
                        m.castAluminium,
                        'y',
                        x,
                        blockBase + height / 2,
                        0,
                        { segments: 24 },
                    ),
                );
            }

            const count = Math.max(4, Math.floor((height - 0.01) / 0.0105));
            fins.add(
                instanced(
                    finGeometry(
                        bores.length > 1 ? width : g.bore + 0.075,
                        depth,
                        0.0032,
                        0.02,
                    ),
                    finMetal,
                    Array.from({ length: count }, (_, i) => {
                        const grow = 0.88 + (0.12 * i) / Math.max(1, count - 1);

                        return {
                            x: 0,
                            y: blockBase + 0.006 + i * 0.0105,
                            z: 0,
                            sx: grow,
                            sz: grow,
                        };
                    }),
                ),
            );
            add('fins', fins, frame);
        } else {
            add(
                'block',
                softBox(
                    width,
                    height,
                    depth,
                    m.castAluminium,
                    0,
                    blockBase + height / 2,
                    0,
                    {
                        divisions: [bores.length * 2 + 1, 2, 2],
                        crease: 1.2,
                        shape: (p) => {
                            // The water jacket bulges round each bore.
                            const phase =
                                ((p.x - bores[0]) / g.pitch) * Math.PI;
                            p.z *= 1 + Math.pow(Math.cos(phase), 2) * 0.07;
                        },
                    },
                ),
                frame,
            );
            // The cam chain tunnel up the right-hand end.
            add(
                'block',
                softBox(
                    0.028,
                    height + headHeight * 0.9,
                    depth * 0.62,
                    m.castAluminium,
                    -width / 2 - 0.011,
                    blockBase + (height + headHeight * 0.9) / 2,
                    0,
                    {
                        crease: 1,
                    },
                ),
                frame,
            );
        }

        // The head, finned on an air-cooled engine, with the cam cover on
        // top and the plugs.
        const head = new THREE.Group();
        head.add(
            softBox(
                width + (air ? -0.006 : 0.004),
                headHeight,
                depth + (air ? -0.01 : 0.012),
                m.castAluminium,
                0,
                barrelTop + headHeight / 2,
                0,
                {
                    divisions: [bores.length + 1, 1, 2],
                    crease: 1.1,
                },
            ),
        );

        if (air) {
            const count = Math.max(3, Math.floor((headHeight - 0.008) / 0.012));
            head.add(
                instanced(
                    finGeometry(width + 0.035, depth + 0.04, 0.003, 0.022),
                    finMetal,
                    Array.from({ length: count }, (_, i) => ({
                        x: 0,
                        y: barrelTop + 0.007 + i * 0.012,
                        z: 0,
                    })),
                ),
            );
        }

        head.add(
            softBox(
                width - 0.014,
                coverHeight,
                depth - 0.022,
                coverMetal,
                0,
                top + coverHeight / 2,
                0,
                {
                    divisions: [bores.length + 1, 1, 2],
                    crease: 0.7,
                    shape: (p) => {
                        p.y +=
                            Math.cos((p.z / (depth / 2)) * (Math.PI / 2)) *
                            0.006;
                    },
                },
            ),
        );
        head.add(
            bolts(
                bolt,
                0.0042,
                [...bores, -width / 2 + 0.024, width / 2 - 0.024].flatMap((x) =>
                    [1, -1].map(
                        (side) =>
                            [
                                x,
                                top + coverHeight - 0.004,
                                side * (depth / 2 - 0.03),
                            ] as Point3,
                    ),
                ),
            ),
        );

        for (const x of bores) {
            if (air) {
                // The plug in the side of the head, its lead looping up.
                const plug: Point3 = [
                    x,
                    barrelTop + headHeight * 0.6,
                    -(depth / 2 + 0.004),
                ];
                head.add(
                    rod(
                        plug,
                        [x, plug[1] + 0.022, plug[2] - 0.028],
                        0.0085,
                        m.gloss,
                    ),
                );
                head.add(
                    tube(
                        [
                            [x, plug[1] + 0.02, plug[2] - 0.026],
                            [x + 0.015, top + 0.012, plug[2] - 0.05],
                            [
                                x + 0.03,
                                top + coverHeight + 0.012,
                                -depth / 2 + 0.01,
                            ],
                        ],
                        0.0035,
                        m.wire,
                    ),
                );
            } else {
                // A coil sitting on each plug, through the cam cover.
                head.add(
                    softBox(
                        0.026,
                        0.05,
                        0.03,
                        m.gloss,
                        x,
                        top + coverHeight + 0.01,
                        0,
                        { crease: 0.5 },
                    ),
                );
                head.add(
                    box(
                        0.014,
                        0.012,
                        0.018,
                        m.plastic,
                        x,
                        top + coverHeight + 0.034,
                        -0.012,
                        0.003,
                    ),
                );
            }
        }

        if (!air && bores.length > 1) {
            head.add(
                tube(
                    bores.map(
                        (x) => [x, top + coverHeight + 0.04, -0.02] as Point3,
                    ),
                    0.005,
                    m.wire,
                ),
            );
        }

        add('head', head, frame);

        // Exhaust flanges on the ports.
        const flanges = new THREE.Group();
        const portY = barrelTop + headHeight * 0.42;
        const face = depth / 2 + (air ? 0.004 : 0.007);

        for (const x of bores) {
            flanges.add(
                puck(g.bore * 0.27, 0.012, m.steel, 'z', x, portY, face),
            );
            flanges.add(
                bolts(
                    bolt,
                    0.004,
                    [
                        [x - g.bore * 0.3, portY, face + 0.006],
                        [x + g.bore * 0.3, portY, face + 0.006],
                    ],
                    'z',
                ),
            );
            exhaustPorts.push({
                at: inEngine(frame, x, portY, face + 0.004),
                direction: new THREE.Vector3(0, -0.22, 1)
                    .applyQuaternion(frame.quaternion)
                    .normalize(),
            });
        }

        add('exhaust', flanges, frame);

        // Rubber boots, throttle bodies and injectors behind the head.
        const intake = new THREE.Group();
        const fuel = new THREE.Group();
        const injectorTops: THREE.Vector3[] = [];
        const shafts: THREE.Vector3[] = [];

        for (const x of bores) {
            const port = new THREE.Vector3(
                x,
                barrelTop + headHeight * 0.5,
                -(depth / 2 + 0.002),
            );
            const bootEnd = port
                .clone()
                .addScaledVector(intakeDirection, 0.035);
            const bodyEnd = port
                .clone()
                .addScaledVector(intakeDirection, 0.095);
            intake.add(
                tube(
                    [
                        port.toArray() as Point3,
                        port
                            .clone()
                            .addScaledVector(intakeDirection, 0.018)
                            .toArray() as Point3,
                        bootEnd.toArray() as Point3,
                    ],
                    g.bore * 0.27,
                    m.rubber,
                    { radial: 16 },
                ),
            );
            intake.add(
                rod(
                    bootEnd.toArray() as Point3,
                    bodyEnd.toArray() as Point3,
                    g.bore * 0.3,
                    m.castAluminium,
                    20,
                ),
            );
            const lip = torus(g.bore * 0.3, 0.003, m.polished, 'z', 0, 0, 0, {
                radial: 6,
                tubular: 24,
            });
            lip.position.copy(bodyEnd);
            lip.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                intakeDirection,
            );
            intake.add(lip);

            const injectorBase = bootEnd
                .clone()
                .lerp(bodyEnd, 0.35)
                .addScaledVector(intakeUp, g.bore * 0.3);
            const injectorTop = injectorBase
                .clone()
                .addScaledVector(intakeUp, 0.028);
            fuel.add(
                rod(
                    injectorBase.toArray() as Point3,
                    injectorTop.toArray() as Point3,
                    0.0065,
                    m.gloss,
                ),
            );
            injectorTops.push(injectorTop);
            shafts.push(
                bootEnd
                    .clone()
                    .lerp(bodyEnd, 0.55)
                    .addScaledVector(intakeUp, -(g.bore * 0.3 + 0.006)),
            );
            intakeEnds.push(bodyEnd.clone().applyMatrix4(frame.matrix));
        }

        if (bores.length > 1) {
            // Linkage shaft across the throttle bodies, its pulley on the end.
            const first = shafts[0];
            const last = shafts[shafts.length - 1];
            intake.add(
                rod(
                    [first.x - 0.02, first.y, first.z],
                    [last.x + 0.02, last.y, last.z],
                    0.004,
                    m.steel,
                ),
            );
            intake.add(
                puck(
                    0.018,
                    0.01,
                    m.castAluminium,
                    'x',
                    last.x + 0.028,
                    last.y,
                    last.z,
                ),
            );
            const railFirst = injectorTops[0];
            const railLast = injectorTops[injectorTops.length - 1];
            fuel.add(
                rod(
                    [railFirst.x - 0.015, railFirst.y, railFirst.z],
                    [railLast.x + 0.015, railLast.y, railLast.z],
                    0.007,
                    m.stainless,
                ),
            );
        } else {
            fuel.add(
                tube(
                    [
                        injectorTops[0].toArray() as Point3,
                        [
                            injectorTops[0].x + 0.04,
                            injectorTops[0].y + 0.02,
                            injectorTops[0].z - 0.02,
                        ],
                    ],
                    0.004,
                    m.hose,
                ),
            );
        }

        add('intake', intake, frame);
        add('fuel', fuel, frame);
    }

    // The cases: a crank chamber across the full width with the oil pan
    // under it, and the gearbox behind, flush on the clutch side and
    // narrower on the left where the sprocket comes out.
    const caseFront = flat ? 0.15 : chamber * 1.04 + 0.008;

    if (flat) {
        add(
            'block',
            softBox(caseWidth, 0.25, 0.3, caseMetal, 0, -0.015, -0.01, {
                crease: 1,
                divisions: [2, 2, 2],
            }),
        );
        add(
            'block',
            softBox(0.17, 0.2, 0.16, caseMetal, 0, -0.03, -0.235, {
                crease: 0.9,
            }),
        );
        const front = new THREE.Group();
        front.add(dome(0.1, 0.035, coverMetal, 'z', 1, [0, -0.01, 0.14]));
        front.add(
            bolts(
                bolt,
                0.0042,
                circle(8, 0.106, -0.01, 0).map(
                    ([y, x]) => [x, y, 0.141] as Point3,
                ),
                'z',
            ),
        );
        add('alternator', front);
        add(
            'sump',
            softBox(0.2, 0.05, 0.24, caseMetal, 0, -0.16, -0.02, {
                crease: 0.8,
            }),
        );
        add('sump', bolts(bolt, 0.006, [[0.02, -0.186, 0.02]], '-y'));
    } else {
        add(
            'block',
            sideExtrusion(
                [
                    [chamber * 0.5, chamber * 0.95],
                    [chamber * 0.98, chamber * 0.4],
                    [chamber * 1.04, -chamber * 0.3],
                    [chamber * 0.9, -chamber - 0.02],
                    [-chamber * 0.5, -chamber - 0.02],
                    [-chamber * 0.75, -chamber * 0.3],
                    [-chamber * 0.6, chamber * 0.7],
                ],
                caseWidth,
                caseMetal,
                0.028,
                0.008,
            ),
        );
        const gearboxLeft = 0.07;
        add(
            'block',
            sideExtrusion(
                [
                    [-chamber * 0.2, chamber * 0.9],
                    [-0.14, chamber * 0.8],
                    [-0.215, 0.04],
                    [-0.24, -0.03],
                    [-0.215, -0.1],
                    [-0.12, -chamber - 0.03],
                    [-chamber * 0.2, -chamber - 0.03],
                ],
                caseWidth / 2 + gearboxLeft,
                caseMetal,
                0.025,
                0.008,
                (gearboxLeft - caseWidth / 2) / 2,
            ),
        );
        add(
            'sump',
            sideExtrusion(
                [
                    [chamber * 0.85, -chamber + 0.005],
                    [chamber * 0.7, sumpY],
                    [-0.1, sumpY],
                    [-0.13, -chamber + 0.005],
                ],
                Math.min(caseWidth - 0.02, 0.2),
                caseMetal,
                0.015,
                0.006,
            ),
        );
        add('sump', bolts(bolt, 0.006, [[0.02, sumpY - 0.001, 0]], '-y'));

        // Alternator cover over the left end of the crank.
        const alternatorRadius = chamber * 0.95;
        const alternator = new THREE.Group();
        alternator.add(
            dome(alternatorRadius, 0.034, coverMetal, 'x', 1, [
                caseWidth / 2,
                0,
                0,
            ]),
        );
        alternator.add(
            torus(
                alternatorRadius - 0.002,
                0.0028,
                m.polished,
                'x',
                caseWidth / 2 + 0.006,
                0,
                0,
                { radial: 6, tubular: 48 },
            ),
        );
        alternator.add(
            bolts(
                bolt,
                0.0042,
                circle(8, alternatorRadius + 0.006).map(
                    ([y, z]) => [caseWidth / 2, y, z] as Point3,
                ),
                'x',
            ),
        );
        add('alternator', alternator);

        // Clutch cover on the right, with the crank end cover ahead of it,
        // the oil level window and the filler cap.
        const clutch = new THREE.Group();
        const clutchZ = -0.085;
        const clutchRadius = 0.088;
        clutch.add(
            dome(clutchRadius, 0.046, coverMetal, 'x', -1, [
                -caseWidth / 2,
                -0.004,
                clutchZ,
            ]),
        );
        clutch.add(
            dome(chamber * 0.55, 0.026, coverMetal, 'x', -1, [
                -caseWidth / 2,
                0,
                0.012,
            ]),
        );
        clutch.add(
            bolts(
                bolt,
                0.0042,
                circle(10, clutchRadius + 0.006, -0.004, clutchZ).map(
                    ([y, z]) => [-caseWidth / 2, y, z] as Point3,
                ),
                '-x',
            ),
        );
        clutch.add(
            puck(
                0.013,
                0.006,
                m.glass,
                'x',
                -caseWidth / 2 - 0.026,
                -0.06,
                clutchZ - 0.035,
            ),
        );
        clutch.add(
            torus(
                0.014,
                0.002,
                m.polished,
                'x',
                -caseWidth / 2 - 0.028,
                -0.06,
                clutchZ - 0.035,
                { radial: 6, tubular: 24 },
            ),
        );
        clutch.add(
            puck(
                0.016,
                0.016,
                m.gloss,
                'y',
                -caseWidth / 2 - 0.02,
                0.07,
                clutchZ - 0.02,
            ),
        );
        add('block', clutch);

        // Sprocket cover and the gear shift shaft on the left.
        add(
            'block',
            softBox(0.02, 0.095, 0.12, m.plastic, 0.105, -0.012, -0.17, {
                crease: 0.6,
            }),
        );
        add(
            'block',
            rod(
                [gearboxLeft, -0.075, -0.112],
                [0.13, -0.075, -0.112],
                0.006,
                m.steel,
            ),
        );
    }

    // Starter motor with its end caps, oil filter at the front.
    const starter = new THREE.Group();

    if (flat) {
        starter.add(
            cyl(0.026, 0.11, m.gloss, 'z', 0.075, -0.1, -0.2, { segments: 20 }),
        );
    } else {
        const at: Point3 = [-0.01, chamber * 0.82 + 0.026, -0.13];
        starter.add(
            cyl(0.025, 0.1, m.gloss, 'x', at[0], at[1], at[2], {
                segments: 20,
            }),
        );

        for (const side of [1, -1]) {
            starter.add(
                puck(
                    0.026,
                    0.014,
                    m.castAluminium,
                    'x',
                    at[0] + side * 0.055,
                    at[1],
                    at[2],
                ),
            );
        }
    }

    add('starter', starter);
    add(
        'filter',
        cyl(
            0.032,
            0.06,
            m.gloss,
            'z',
            flat ? 0 : caseWidth * 0.2,
            flat ? -0.12 : -chamber * 0.62,
            flat ? 0.17 : caseFront + 0.03,
            { segments: 24 },
        ),
    );

    // Air: an airbox over the throttle bodies, or a round cleaner out on
    // the right of a big twin.
    if (intakeEnds.length > 0) {
        const centre = intakeEnds
            .reduce((sum, point) => sum.add(point), new THREE.Vector3())
            .divideScalar(intakeEnds.length);
        const airbox = new THREE.Group();

        if (cruiser) {
            const at = new THREE.Vector3(
                -caseWidth / 2 - 0.07,
                centre.y - 0.07,
                centre.z,
            );
            airbox.add(puck(0.075, 0.05, m.chrome, 'x', at.x, at.y, at.z));
            airbox.add(
                puck(0.036, 0.012, m.polished, 'x', at.x - 0.03, at.y, at.z),
            );
            airbox.add(
                tube(
                    [
                        centre.toArray() as Point3,
                        [centre.x - 0.05, centre.y, centre.z],
                        [at.x + 0.02, at.y, at.z],
                    ],
                    0.024,
                    m.castAluminium,
                ),
            );
        } else if (flat) {
            const at = new THREE.Vector3(0, 0.13, -0.19);
            airbox.add(
                softBox(0.22, 0.1, 0.18, m.plastic, at.x, at.y, at.z, {
                    crease: 0.8,
                    divisions: [2, 1, 2],
                }),
            );

            for (const end of intakeEnds) {
                airbox.add(
                    tube(
                        [
                            end.toArray() as Point3,
                            [end.x * 0.6, end.y + 0.03, (end.z + at.z) / 2],
                            [Math.sign(end.x) * 0.1, at.y, at.z],
                        ],
                        0.026,
                        m.rubber,
                    ),
                );
            }
        } else {
            const span =
                Math.max(...intakeEnds.map((point) => Math.abs(point.x))) * 2;
            airbox.add(
                softBox(
                    Math.max(0.2, span + 0.12),
                    0.075,
                    0.2,
                    m.plastic,
                    centre.x,
                    centre.y + 0.035,
                    centre.z - 0.03,
                    {
                        crease: 0.8,
                        divisions: [2, 1, 2],
                    },
                ),
            );
        }

        add('airbox', airbox);
    }

    // Radiator ahead of the cylinders with its fan behind, hoses to the
    // head and the water pump.
    if (!air) {
        let front = -Infinity;
        let highest = 0;
        let thermostat = new THREE.Vector3();

        for (const { frame, bores } of banks) {
            const width = bores.length * g.pitch + 0.03;
            const corner = inEngine(frame, 0, top + coverHeight, depth / 2);
            front = Math.max(
                front,
                corner.z,
                inEngine(frame, 0, barrelTop, depth / 2).z,
            );
            highest = Math.max(highest, corner.y);

            if (frame === banks[0].frame) {
                thermostat = inEngine(
                    frame,
                    -width / 2 + 0.03,
                    barrelTop + headHeight * 0.75,
                    depth / 2 + 0.012,
                );
            }
        }

        const radiatorWidth = THREE.MathUtils.clamp(
            caseWidth + 0.1,
            0.26,
            0.44,
        );
        const radiatorHeight = THREE.MathUtils.clamp(
            highest * 0.85,
            0.18,
            0.28,
        );
        const radiator = new THREE.Group();
        radiator.position.set(0, highest * 0.5, front + 0.1);
        radiator.rotation.x = -0.28;
        radiator.add(
            box(
                radiatorWidth - 0.04,
                radiatorHeight - 0.02,
                0.026,
                m.castIron,
                0,
                0,
                0,
                0.003,
            ),
        );
        radiator.add(
            instanced(
                new THREE.BoxGeometry(0.0016, radiatorHeight - 0.03, 0.028),
                m.satin,
                Array.from(
                    { length: Math.floor((radiatorWidth - 0.06) / 0.0075) },
                    (_, i) => ({
                        x: -(radiatorWidth - 0.06) / 2 + i * 0.0075,
                        y: 0,
                        z: 0.001,
                    }),
                ),
            ),
        );

        for (const side of [1, -1]) {
            radiator.add(
                box(
                    0.024,
                    radiatorHeight + 0.01,
                    0.04,
                    m.plastic,
                    side * (radiatorWidth / 2 - 0.012),
                    0,
                    0,
                    0.006,
                ),
            );
        }

        radiator.add(
            box(
                radiatorWidth - 0.04,
                0.01,
                0.03,
                m.gloss,
                0,
                radiatorHeight / 2 - 0.004,
                0,
                0.003,
            ),
        );
        radiator.add(
            puck(
                0.014,
                0.012,
                m.steel,
                'y',
                -(radiatorWidth / 2 - 0.012),
                radiatorHeight / 2 + 0.01,
                0,
            ),
        );
        radiator.add(puck(0.03, 0.03, m.gloss, 'z', 0, 0, -0.035));
        radiator.add(
            torus(0.085, 0.006, m.plastic, 'z', 0, 0, -0.035, {
                radial: 6,
                tubular: 40,
            }),
        );
        radiator.add(
            instanced(
                new THREE.BoxGeometry(0.03, 0.05, 0.004),
                m.plastic,
                Array.from({ length: 7 }, (_, i) => {
                    const a = (i / 7) * Math.PI * 2;

                    return {
                        x: Math.cos(a) * 0.052,
                        y: Math.sin(a) * 0.052,
                        z: -0.035,
                        rz: a + Math.PI / 2,
                        rx: 0.5,
                    };
                }),
            ),
        );
        add('radiator', radiator);

        radiator.updateMatrix();
        const onRadiator = (x: number, y: number, z: number): Point3 =>
            new THREE.Vector3(x, y, z)
                .applyMatrix4(radiator.matrix)
                .toArray() as Point3;
        const pump: Point3 = [
            caseWidth / 2 + 0.012,
            -chamber - 0.015,
            chamber * 0.85,
        ];
        const hoses = new THREE.Group();
        hoses.add(
            puck(0.03, 0.028, m.castAluminium, 'x', pump[0], pump[1], pump[2]),
        );
        const topTank = onRadiator(
            -(radiatorWidth / 2 - 0.012),
            radiatorHeight / 2 - 0.03,
            -0.022,
        );
        hoses.add(
            hose(
                m,
                [
                    topTank,
                    [
                        (topTank[0] + thermostat.x) / 2,
                        Math.max(topTank[1], thermostat.y) + 0.02,
                        (topTank[2] + thermostat.z) / 2,
                    ],
                    thermostat.toArray() as Point3,
                ],
                0.011,
            ),
        );
        const bottomTank = onRadiator(
            radiatorWidth / 2 - 0.012,
            -radiatorHeight / 2 + 0.03,
            -0.022,
        );
        hoses.add(
            hose(
                m,
                [
                    bottomTank,
                    [
                        pump[0] + 0.01,
                        (bottomTank[1] + pump[1]) / 2,
                        (bottomTank[2] + pump[2]) / 2 + 0.02,
                    ],
                    [pump[0] + 0.01, pump[1] + 0.012, pump[2] + 0.03],
                ],
                0.011,
            ),
        );
        add('radiator', hoses);
    }

    // Headers from every port down to where the machine's own pipe starts.
    const target =
        exhaustTo?.clone() ?? new THREE.Vector3(0, sumpY - 0.05, -0.08);
    const pipeRadius = THREE.MathUtils.clamp(g.bore * 0.2, 0.014, 0.022);
    const heated = clonePatched(cruiser ? m.chrome : m.stainless);
    heated.vertexColors = true;
    const headers = new THREE.Group();

    for (const { at, direction } of exhaustPorts) {
        headers.add(
            heatedPipe(
                headerPath(
                    at,
                    direction,
                    target,
                    caseFront,
                    sumpY,
                    -caseWidth / 2 - 0.04,
                ),
                pipeRadius,
                heated,
            ),
        );
    }

    if (exhaustPorts.length > 1) {
        headers.add(
            puck(
                pipeRadius * 1.8,
                0.07,
                cruiser ? m.chrome : m.stainless,
                'z',
                target.x,
                target.y,
                target.z + 0.03,
            ),
        );
    }

    add('exhaust', headers);
}

/* ------------------------------------------------------------------------ */
/* Small air-cooled engines                                                 */
/* ------------------------------------------------------------------------ */

/**
 * A single or V-twin air-cooled OHV engine, as in mowers, generators and
 * utility vehicles: finned barrels, a fan shroud over the flywheel, a
 * recoil starter or starter motor, carburettor and air filter, and a
 * muffler with a guard. On a mower the crank stands up and the shroud
 * sits on top.
 */
function buildSmallEngine(b: Builder, vertical: boolean): void {
    const { m, g, add } = b;
    const holder = new THREE.Group();

    // Build with the crank along X, then stand it up for a mower.
    if (vertical) {
        holder.rotation.z = Math.PI / 2;
    }

    b.group.add(holder);
    const local = <T extends THREE.Object3D>(
        key: EnginePartKey,
        object: T,
    ): T => add(key, object, holder);

    const caseSize = g.stroke + 0.14;
    local(
        'block',
        softBox(caseSize, caseSize, caseSize * 1.1, m.castAluminium, 0, 0, 0, {
            crease: 1,
            divisions: [2, 2, 2],
        }),
    );
    local(
        'sump',
        softBox(
            caseSize * 0.9,
            0.04,
            caseSize,
            m.castAluminium,
            0,
            -caseSize / 2 - 0.015,
            0,
            { crease: 0.8 },
        ),
    );
    local(
        'sump',
        dipstick(
            m,
            [-caseSize / 2, -0.02, caseSize / 2],
            [-caseSize / 2 - 0.05, caseSize / 2 + 0.06, caseSize / 2 + 0.03],
        ),
    );

    const angles = g.cylinders >= 2 ? [g.veeAngle / 2, -g.veeAngle / 2] : [0.4];

    angles.forEach((angle, index) => {
        const bank = new THREE.Group();
        bank.rotation.x = angle;
        bank.position.x = index === 0 ? -0.02 : 0.02;
        const barrel = g.deck;
        const fins = new THREE.Group();
        fins.add(
            cyl(
                g.bore * 0.62,
                barrel,
                m.castAluminium,
                'y',
                0,
                caseSize * 0.3 + barrel / 2,
                0,
                { segments: 24 },
            ),
        );
        fins.add(
            instanced(
                new THREE.BoxGeometry(g.bore * 1.6, 0.004, g.bore * 1.5),
                m.castAluminium,
                Array.from({ length: Math.floor(barrel / 0.012) }, (_, i) => ({
                    x: 0,
                    y: caseSize * 0.3 + 0.01 + i * 0.012,
                    z: 0,
                })),
            ),
        );
        add('fins', fins, bank);
        const head = new THREE.Group();
        const headBase = caseSize * 0.3 + barrel;
        head.add(
            softBox(
                g.bore * 1.5,
                0.06,
                g.bore * 1.5,
                m.castAluminium,
                0,
                headBase + 0.03,
                0,
                { crease: 1 },
            ),
        );
        head.add(
            softBox(
                g.bore * 1.2,
                0.035,
                g.bore * 1.1,
                m.crinkle,
                0,
                headBase + 0.08,
                0,
                { crease: 0.6 },
            ),
        );
        head.add(
            cyl(0.008, 0.03, m.steel, 'z', 0, headBase + 0.03, g.bore * 0.75),
        );
        head.add(
            softBox(
                0.02,
                0.05,
                0.02,
                m.gloss,
                0,
                headBase + 0.03,
                g.bore * 0.8 + 0.02,
                { crease: 0.5 },
            ),
        );
        head.add(
            tube(
                [
                    [0, headBase + 0.05, g.bore * 0.8 + 0.02],
                    [0.03, headBase + 0.02, g.bore + 0.06],
                    [0.08, 0.0, caseSize * 0.6],
                ],
                0.004,
                m.wire,
            ),
        );
        add('head', head, bank);
        holder.add(bank);

        // Muffler on the exhaust side of each head.
        const exhaust = new THREE.Group();
        exhaust.add(
            tube(
                [
                    [0, headBase + 0.02, -g.bore * 0.7],
                    [0, headBase - 0.01, -g.bore * 0.7 - 0.05],
                    [0, headBase - 0.06, -g.bore - 0.08],
                ],
                0.014,
                m.exhaust,
            ),
        );
        add('exhaust', exhaust, bank);
    });

    // Fan shroud over the flywheel end, with the recoil starter.
    const shroud = new THREE.Group();
    const radius = caseSize * 0.85;
    shroud.add(puck(radius, 0.08, m.enamel, 'x', caseSize / 2 + 0.05, 0.02, 0));
    shroud.add(
        puck(radius * 0.45, 0.04, m.plastic, 'x', caseSize / 2 + 0.1, 0.02, 0),
    );
    shroud.add(
        instanced(
            new THREE.BoxGeometry(0.006, radius * 0.5, 0.012),
            m.plastic,
            Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;

                return {
                    x: caseSize / 2 + 0.121,
                    y: 0.02 + Math.cos(a) * radius * 0.2,
                    z: Math.sin(a) * radius * 0.2,
                    rx: -a,
                };
            }),
        ),
    );

    if (!vertical) {
        shroud.add(
            box(
                0.03,
                0.025,
                0.07,
                m.gloss,
                caseSize / 2 + 0.13,
                0.02 + radius * 0.6,
                0.05,
                0.01,
            ),
        );
    }

    local('fins', shroud);

    // Carburettor and air filter on the intake side, starter on the other.
    local(
        'intake',
        softBox(
            0.06,
            0.06,
            0.07,
            m.castAluminium,
            -0.02,
            caseSize * 0.55,
            caseSize * 0.62,
            { crease: 0.6 },
        ),
    );
    local(
        'airbox',
        softBox(
            0.16,
            0.14,
            0.08,
            m.gloss,
            -0.02,
            caseSize * 0.62,
            caseSize * 0.62 + 0.08,
            { crease: 0.8 },
        ),
    );
    local(
        'fuel',
        tube(
            [
                [-0.02, caseSize * 0.5, caseSize * 0.58],
                [0.05, caseSize * 0.3, caseSize * 0.7],
                [0.1, caseSize * 0.6, caseSize * 0.4],
            ],
            0.004,
            m.hose,
        ),
    );
    const starter = new THREE.Group();
    starter.add(
        cyl(0.03, 0.09, m.gloss, 'x', -0.02, -caseSize * 0.2, -caseSize * 0.6, {
            segments: 20,
        }),
    );
    local('starter', starter);

    if (g.cylinders >= 2) {
        local(
            'filter',
            cyl(
                0.03,
                0.06,
                m.blue,
                'z',
                -0.03,
                -caseSize * 0.25,
                caseSize * 0.56,
                { segments: 20 },
            ),
        );
    }
}

/* ------------------------------------------------------------------------ */
/* Outboard powerhead                                                       */
/* ------------------------------------------------------------------------ */

/**
 * An outboard's powerhead: the crank stands upright, the cylinders are
 * stacked one above another lying back from the crankcase, and the head
 * faces aft with a coil on every plug. The flywheel sits on top over the
 * alternator's copper stator, the timing belt runs beneath it to the cam
 * sprockets, and the intake runners wrap round the port side from the
 * silencer on the front. +X points at the boat.
 */
function buildPowerhead(b: Builder): void {
    const { m, g, add } = b;
    const count = g.cylinders;
    const stack = count * g.pitch + 0.06;
    const width = g.bore + 0.07;
    const chamber = g.stroke / 2 + 0.045;
    const headHeight = 0.05 + g.bore * 0.3;
    const coverDepth = 0.035;
    const bores = Array.from(
        { length: count },
        (_, i) => (i - (count - 1) / 2) * g.pitch,
    );
    const headFace = -g.deck;
    const back = headFace - headHeight;
    const top = stack / 2;

    // Crankcase rounding off round the crank, the block with a bulge at
    // every bore, the exhaust passages cast up its starboard side.
    add(
        'block',
        softBox(
            chamber * 1.7,
            stack,
            width + 0.05,
            m.castAluminium,
            chamber * 0.15,
            0,
            0,
            {
                divisions: [2, Math.max(2, count), 2],
                crease: 1,
                shape: (p) => {
                    const front = Math.max(0, p.x) / (chamber * 0.85);
                    p.z *= 1 - front * front * 0.3;
                },
            },
        ),
    );
    const blockLength = g.deck - chamber * 0.6;
    add(
        'block',
        softBox(
            blockLength,
            stack - 0.02,
            width,
            m.castAluminium,
            -chamber * 0.6 - blockLength / 2,
            0,
            0,
            {
                divisions: [2, count * 2 + 1, 2],
                crease: 1.1,
                shape: (p) => {
                    const phase = ((p.y - bores[0]) / g.pitch) * Math.PI;
                    p.z *= 1 + Math.pow(Math.cos(phase), 2) * 0.08;
                },
            },
        ),
    );
    add(
        'exhaust',
        softBox(
            blockLength * 0.75,
            stack * 0.86,
            0.03,
            m.castAluminium,
            -chamber * 0.6 - blockLength / 2,
            -0.01,
            width / 2 + 0.012,
            { crease: 0.9 },
        ),
    );

    // Head and cam cover facing aft, a coil on each plug.
    const head = new THREE.Group();
    head.add(
        softBox(
            headHeight,
            stack - 0.01,
            width + 0.012,
            m.castAluminium,
            headFace - headHeight / 2,
            0,
            0,
            {
                divisions: [1, count + 1, 2],
                crease: 1.1,
            },
        ),
    );
    head.add(
        softBox(
            coverDepth,
            stack - 0.05,
            width - 0.015,
            m.crinkle,
            back - coverDepth / 2,
            0,
            0,
            {
                divisions: [1, count + 1, 2],
                crease: 0.7,
                shape: (p) => {
                    p.x -=
                        Math.cos((p.z / (width / 2)) * (Math.PI / 2)) * 0.006;
                },
            },
        ),
    );
    head.add(
        bolts(
            m.zinc,
            0.0045,
            [...bores, -top + 0.04, top - 0.04].flatMap((y) =>
                [1, -1].map(
                    (side) =>
                        [
                            back - coverDepth + 0.004,
                            y,
                            side * (width / 2 - 0.022),
                        ] as Point3,
                ),
            ),
            '-x',
        ),
    );

    for (const y of bores) {
        head.add(
            softBox(
                0.05,
                0.03,
                0.028,
                m.gloss,
                back - coverDepth - 0.012,
                y,
                0,
                { crease: 0.5 },
            ),
        );
        head.add(
            box(
                0.016,
                0.014,
                0.018,
                m.plastic,
                back - coverDepth - 0.036,
                y + 0.008,
                0.01,
                0.003,
            ),
        );
    }

    if (count > 1) {
        head.add(
            tube(
                bores.map(
                    (y) =>
                        [back - coverDepth - 0.04, y + 0.012, 0.024] as Point3,
                ),
                0.005,
                m.wire,
            ),
        );
    }

    add('head', head);

    // Flywheel with its ring gear on top, the stator's copper windings
    // under it.
    const flywheel = new THREE.Group();
    flywheel.add(puck(0.14, 0.05, m.gloss, 'y', 0, top + 0.085, 0));
    flywheel.add(
        torus(0.141, 0.007, m.steel, 'y', 0, top + 0.07, 0, {
            radial: 6,
            tubular: 72,
        }),
    );
    flywheel.add(puck(0.03, 0.02, m.steel, 'y', 0, top + 0.115, 0));
    add('flywheel', flywheel);
    const stator = new THREE.Group();
    stator.add(puck(0.075, 0.026, m.castAluminium, 'y', 0, top + 0.042, 0));
    stator.add(
        instanced(
            new THREE.BoxGeometry(0.024, 0.024, 0.016),
            m.copper,
            Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;

                return {
                    x: Math.cos(a) * 0.088,
                    y: top + 0.042,
                    z: Math.sin(a) * 0.088,
                    ry: -a,
                };
            }),
        ),
    );
    add('alternator', stator);

    // Timing belt from the crank sprocket to the two cam sprockets.
    const beltY = top + 0.014;
    const camX = headFace - headHeight * 0.5;
    const sprockets: Wheel[] = [
        { y: 0, z: 0, r: 0.038 },
        { y: camX, z: 0.046, r: 0.042 },
        { y: camX, z: -0.046, r: 0.042 },
    ];
    const centre = { x: camX / 3, z: 0 };
    sprockets.sort(
        (a, c) =>
            Math.atan2(a.z - centre.z, a.y - centre.x) -
            Math.atan2(c.z - centre.z, c.y - centre.x),
    );
    const belt = new THREE.Group();

    for (const sprocket of sprockets) {
        belt.add(
            puck(
                sprocket.r,
                0.022,
                m.steel,
                'y',
                sprocket.y,
                beltY,
                sprocket.z,
            ),
        );
    }

    const path = beltPath(sprockets, beltY).map(
        ([y, x, z]) => [x, y, z] as Point3,
    );
    belt.add(
        tube(path, 0.005, m.belt, {
            closed: true,
            segments: path.length * 3,
            radial: 6,
            tension: 0.2,
        }),
    );
    add('belt', belt);

    // Intake: the silencer on the front, runners wrapping round the port
    // side into the head, an injector in each, the vapour separator tank
    // and fuel filter at the front corner.
    const intake = new THREE.Group();
    const front = chamber + 0.06;
    intake.add(
        softBox(0.08, stack * 0.85, width + 0.08, m.engineCover, front, 0, 0, {
            crease: 0.8,
            divisions: [1, 2, 2],
        }),
    );
    const fuel = new THREE.Group();
    const side = -(width / 2 + 0.06);

    for (const y of bores) {
        intake.add(
            tube(
                [
                    [front - 0.02, y, -(width / 2 + 0.02)],
                    [chamber * 0.6, y, side],
                    [-chamber * 0.4, y, side - 0.01],
                    [headFace - headHeight * 0.4, y, -(width / 2 + 0.008)],
                ],
                g.bore * 0.22,
                m.castAluminium,
                { radial: 12 },
            ),
        );
        fuel.add(
            rod(
                [-chamber * 0.2, y + 0.012, side - 0.02],
                [-chamber * 0.2, y + 0.03, side - 0.05],
                0.007,
                m.gloss,
            ),
        );
    }

    fuel.add(
        cyl(
            0.007,
            stack * 0.8,
            m.stainless,
            'y',
            -chamber * 0.2,
            0.03,
            side - 0.05,
        ),
    );
    fuel.add(
        cyl(
            0.035,
            0.14,
            m.castAluminium,
            'y',
            front - 0.01,
            -stack * 0.2,
            -(width / 2 + 0.1),
            { segments: 24 },
        ),
    );
    fuel.add(
        cyl(
            0.022,
            0.06,
            m.translucent,
            'y',
            front + 0.04,
            stack * 0.1,
            -(width / 2 + 0.1),
            { segments: 20 },
        ),
    );
    add('intake', intake);
    add('fuel', fuel);

    // Starter standing on the starboard front, its pinion up by the ring
    // gear; the oil filter lower down on the same side.
    const starter = new THREE.Group();
    starter.add(
        cyl(
            0.034,
            0.13,
            m.gloss,
            'y',
            chamber * 0.8,
            top - 0.08,
            width / 2 + 0.06,
            { segments: 20 },
        ),
    );
    starter.add(
        puck(
            0.036,
            0.02,
            m.castAluminium,
            'y',
            chamber * 0.8,
            top - 0.005,
            width / 2 + 0.06,
        ),
    );
    add('starter', starter);
    add(
        'filter',
        cyl(
            0.036,
            0.07,
            m.blue,
            'z',
            -chamber * 0.2,
            -stack * 0.3,
            width / 2 + 0.065,
            { segments: 24 },
        ),
    );
}

/* ------------------------------------------------------------------------ */
/* Electric drive unit                                                      */
/* ------------------------------------------------------------------------ */

/**
 * An EV's drive unit where the engine would be: the motor, the reduction
 * gearbox and differential beside it, the inverter on top with its orange
 * high-voltage cables, and the coolant loop.
 */
function buildDriveUnit(b: Builder): void {
    const { m, add } = b;
    const motor = new THREE.Group();
    motor.add(puck(0.13, 0.32, m.castAluminium, 'x', 0, 0, 0));
    motor.add(
        instanced(
            new THREE.BoxGeometry(0.28, 0.008, 0.02),
            m.castAluminium,
            Array.from({ length: 16 }, (_, i) => {
                const a = (i / 16) * Math.PI * 2;

                return {
                    x: 0,
                    y: Math.cos(a) * 0.132,
                    z: Math.sin(a) * 0.132,
                    rx: -a,
                };
            }),
        ),
    );
    motor.add(puck(0.1, 0.03, m.castAluminium, 'x', 0.175, 0, 0));
    add('motor', motor);

    const reducer = new THREE.Group();
    reducer.add(
        softBox(0.18, 0.3, 0.34, m.castAluminium, -0.25, -0.02, 0.04, {
            crease: 1,
            divisions: [1, 2, 2],
        }),
    );
    reducer.add(cyl(0.03, 0.14, m.steel, 'x', -0.4, -0.05, 0.1));
    reducer.add(cyl(0.03, 0.14, m.steel, 'x', 0.25, -0.05, 0.1));
    add('reducer', reducer);

    const inverter = new THREE.Group();
    inverter.add(
        softBox(0.36, 0.1, 0.26, m.castAluminium, -0.02, 0.2, 0, { crease: 1 }),
    );
    inverter.add(
        bolts(m.zinc, 0.006, [
            [-0.18, 0.25, 0.11],
            [0.14, 0.25, 0.11],
            [-0.18, 0.25, -0.11],
            [0.14, 0.25, -0.11],
        ]),
    );
    const hv = new THREE.MeshStandardMaterial({
        color: 0xff7a1a,
        roughness: 0.45,
    });

    for (const z of [-0.06, 0, 0.06]) {
        inverter.add(
            tube(
                [
                    [0.16, 0.2, z],
                    [0.28, 0.18, z * 1.5],
                    [0.4, 0.05, z * 2],
                ],
                0.012,
                hv,
            ),
        );
    }

    add('inverter', inverter);
    add(
        'radiator',
        hose(
            m,
            [
                [0.1, -0.12, 0.13],
                [0.3, -0.18, 0.2],
                [0.5, -0.1, 0.3],
            ],
            0.016,
        ),
    );
}
