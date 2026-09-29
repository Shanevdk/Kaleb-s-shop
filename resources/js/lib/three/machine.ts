import * as THREE from 'three';
import type { EnginePartKey } from '@/lib/engine-parts';
import { buildAtv, buildMotorcycle } from '@/lib/three/bike';
import {
    COUPE_SPEC,
    HATCH_SPEC,
    SEDAN_SPEC,
    SUV_SPEC,
    VAN_SPEC,
    WAGON_SPEC,
} from '@/lib/three/designs';
import {
    buildEngine,
    displacementLitres,
    type EngineInput,
    type PartMap,
} from '@/lib/three/engine';
import { buildMower, buildTractor } from '@/lib/three/farm';
import { buildBus, buildTruck } from '@/lib/three/heavy';
import { makeMaterials, type Materials } from '@/lib/three/materials';
import {
    buildRoadVehicle,
    type EngineBay,
    type RoadOptions,
    type RoadSpec,
} from '@/lib/three/road';
import {
    buildGenerator,
    buildOutboard,
    buildTrailer,
    buildUtility,
} from '@/lib/three/small';
import { buildUte } from '@/lib/three/ute';
import type { MachineKind } from '@/types';

export type MachineOptions = {
    kind: MachineKind;
    engine: EngineInput;
    doors?: number | null;
    bodyClass?: string | null;
    driveType?: string | null;
    colour?: string | null;
    registration?: string | null;
    rightHandDrive?: boolean;
    /** Subdivision levels for the bodywork: 3 for the best, 2 when slower. */
    levels?: number;
};

export type Machine = {
    root: THREE.Group;
    /** Everything but the engine. */
    body: THREE.Group;
    /** The engine, positioned in its bay. */
    engine: THREE.Group;
    parts: PartMap;
    bay: EngineBay | null;
    materials: Materials;
};

/**
 * Pick the car body that matches what the VIN decoder or the doors say.
 */
function carSpec(bodyClass: string, doors: number | null): RoadSpec {
    if (/hatch/.test(bodyClass)) {
        return HATCH_SPEC;
    }

    if (/wagon|estate/.test(bodyClass)) {
        return WAGON_SPEC;
    }

    if (
        /coupe|convertible|roadster|cabriolet/.test(bodyClass) ||
        (doors !== null && doors <= 2)
    ) {
        return COUPE_SPEC;
    }

    return SEDAN_SPEC;
}

/**
 * Turn the engine round to suit the drivetrain: front-wheel drive cars
 * carry it across, rear-wheel drive ones along, and a V8 always goes
 * along.
 */
function orientBay(
    bay: EngineBay,
    driveType: string,
    input: EngineInput,
): EngineBay {
    const drive = driveType.toLowerCase();
    const big =
        (input.cylinders ?? 4) >= 8 ||
        (displacementLitres(input.displacement) ?? 0) >= 4.5;

    if (/rear|rwd/.test(drive) || big) {
        return { ...bay, rotationY: 0 };
    }

    if (/front|fwd/.test(drive)) {
        return { ...bay, rotationY: Math.PI / 2 };
    }

    return bay;
}

/**
 * Build the whole machine for its kind: the body with all its furniture,
 * and the engine from its specs in the bay the body leaves for it.
 */
export function buildMachine(options: MachineOptions): Machine {
    const materials = makeMaterials({ colour: options.colour });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const road: RoadOptions = {
        registration: options.registration ?? null,
        rightHandDrive: options.rightHandDrive ?? false,
        levels: options.levels,
    };
    const bodyClass = (options.bodyClass ?? '').toLowerCase();
    const doors = options.doors ?? null;
    let bay: EngineBay | null;

    switch (options.kind) {
        case 'car':
            bay = buildRoadVehicle(
                materials,
                carSpec(bodyClass, doors),
                body,
                road,
            );
            break;
        case 'suv':
            bay = buildRoadVehicle(materials, SUV_SPEC, body, road);
            break;
        case 'van':
            bay = buildRoadVehicle(materials, VAN_SPEC, body, road);
            break;
        case 'ute':
            bay = buildUte(materials, body, {
                ...road,
                crew: doors === null || doors >= 4,
            });
            break;
        case 'truck':
            bay = buildTruck(materials, body, road);
            break;
        case 'bus':
            bay = buildBus(materials, body, road);
            break;
        case 'motorcycle':
            bay = { ...buildMotorcycle(materials, body), style: 'bike' };
            break;
        case 'atv':
            bay = { ...buildAtv(materials, body), style: 'bike' };
            break;
        case 'tractor':
            bay = buildTractor(materials, body);
            break;
        case 'mower':
            bay = buildMower(materials, body);
            break;
        case 'outboard':
            bay = buildOutboard(materials, body);
            break;
        case 'generator':
            bay = buildGenerator(materials, body);
            break;
        case 'trailer':
            buildTrailer(materials, body);
            bay = null;
            break;
        default:
            bay = buildUtility(materials, body);
    }

    const engine = new THREE.Group();
    const parts: PartMap = new Map();

    if (bay) {
        if (['car', 'suv', 'van'].includes(options.kind)) {
            bay = orientBay(bay, options.driveType ?? '', options.engine);
        }

        placeEngine(options.engine, materials, engine, parts, bay);
    }

    root.add(engine);

    return { root, body, engine, parts, bay, materials };
}

/**
 * Build the engine at its real size and set it in the bay: turned to run
 * the right way, shrunk a little if a big engine is going into a small
 * space, and leaning with the machine when it stands on a side stand.
 */
function placeEngine(
    input: EngineInput,
    materials: Materials,
    holder: THREE.Group,
    parts: PartMap,
    bay: EngineBay,
): void {
    const engine = new THREE.Group();
    buildEngine(input, materials, engine, parts, bay);

    // Fit the block and heads, not the gearbox or radiator, to the room.
    const core = new THREE.Box3();

    for (const key of ['block', 'head'] as EnginePartKey[]) {
        for (const mesh of parts.get(key) ?? []) {
            core.expandByObject(mesh);
        }
    }

    if (!core.isEmpty() && bay.room.lengthSq() > 0) {
        const size = core.getSize(new THREE.Vector3());
        const scale = Math.min(
            1,
            (bay.room.x * 1.15) / size.x,
            (bay.room.y * 1.25) / size.y,
            (bay.room.z * 1.2) / size.z,
        );
        engine.scale.setScalar(Math.max(0.55, scale));
    }

    engine.position.copy(bay.position);
    engine.rotation.y = bay.rotationY;

    const pivot = new THREE.Group();
    pivot.rotation.x = bay.lean ?? 0;
    pivot.add(engine);
    holder.add(pivot);
}

/**
 * The machine's parts that belong to its outer body, for fading away when
 * the engine is opened up, split by how they should go.
 */
export function shellMeshes(machine: Machine): {
    ghost: THREE.Mesh[];
    hide: THREE.Object3D[];
} {
    const ghost: THREE.Mesh[] = [];
    const hide: THREE.Object3D[] = [];

    machine.body.traverse((object) => {
        if (object.userData.ghost === 'hide') {
            hide.push(object);

            return;
        }

        if (object instanceof THREE.Mesh && !object.userData.part) {
            let hidden = false;
            let parent: THREE.Object3D | null = object;

            while (parent) {
                if (parent.userData.ghost === 'hide') {
                    hidden = true;
                }

                parent = parent.parent;
            }

            if (!hidden) {
                ghost.push(object);
            }
        }
    });

    return { ghost, hide };
}
