import {
    create as mainCreate,
    index as mainIndex,
    store as mainStore,
} from '@/routes/equipment';
import { index as mainChecklists } from '@/routes/equipment-checklists';
import { index as mainSchedule } from '@/routes/equipment-schedule';
import { index as mainServiceLog } from '@/routes/equipment-service-records';
import {
    create as usaCreate,
    index as usaIndex,
    store as usaStore,
} from '@/routes/usa/equipment';
import { index as usaChecklists } from '@/routes/usa/equipment-checklists';
import { index as usaSchedule } from '@/routes/usa/equipment-schedule';
import { index as usaServiceLog } from '@/routes/usa/equipment-service-records';
import type { EquipmentDivision } from '@/types';

/**
 * The lists each equipment division keeps to its own equipment:
 * VDK-Equipment's at the top level and VDK Equipment USA's under /usa. A
 * piece of equipment, and everything logged against it, opens at the same
 * address whichever division it belongs to, so those routes are shared.
 */
export const divisionRoutes = {
    main: {
        index: mainIndex,
        create: mainCreate,
        store: mainStore,
        checklists: mainChecklists,
        serviceLog: mainServiceLog,
        schedule: mainSchedule,
    },
    usa: {
        index: usaIndex,
        create: usaCreate,
        store: usaStore,
        checklists: usaChecklists,
        serviceLog: usaServiceLog,
        schedule: usaSchedule,
    },
} satisfies Record<EquipmentDivision, unknown>;
