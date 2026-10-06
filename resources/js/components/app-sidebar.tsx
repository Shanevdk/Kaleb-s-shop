import { usePage } from '@inertiajs/react';
import {
    Bot,
    CalendarCheck,
    Car,
    ClipboardCheck,
    Cog,
    LayoutGrid,
    Package,
    ShoppingCart,
    Users,
    Wrench,
} from 'lucide-react';
import AppBrandSwitcher from '@/components/app-brand-switcher';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useWorkspace } from '@/hooks/use-workspace';
import type { Workspace } from '@/hooks/use-workspace';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { assistant, dashboard, diagnose, lookup } from '@/routes';
import { index as jobQueue } from '@/routes/job-queue';
import {
    create as logJob,
    index as serviceLog,
} from '@/routes/service-records';
import { index as inspections } from '@/routes/inspections';
import { index as inventory } from '@/routes/inventory';
import { index as receiving } from '@/routes/receiving';
import { index as schedule } from '@/routes/schedule';
import { index as shoppingList } from '@/routes/shopping-list';
import { index as team } from '@/routes/admin/users';
import { index as vehicles } from '@/routes/vehicles';
import type { Auth, EquipmentDivision, NavEntry, NavItem } from '@/types';

/** A nav link that only shows up when the account holds its permission. */
type NavLeaf = NavItem & { permission?: keyof Auth['can'] };

/** A nav link on its own, or a collapsible group of them. */
type NavSection =
    | NavLeaf
    | { title: string; icon?: NavItem['icon']; items: NavLeaf[] };

/** Kaleb's Shop: the vehicle-focused side, picked from the brand switcher. */
const mechanicsNavItems: NavSection[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        permission: 'mechanicsShop',
    },
    {
        title: 'Fleet',
        icon: Car,
        items: [
            { title: 'Vehicles', href: vehicles(), permission: 'vehicles' },
            { title: 'Lookup', href: lookup(), permission: 'lookup' },
        ],
    },
    {
        title: 'Service',
        icon: Wrench,
        items: [
            { title: 'Diagnose', href: diagnose(), permission: 'diagnose' },
            { title: 'Job queue', href: jobQueue(), permission: 'jobQueue' },
            {
                title: 'Service log',
                href: serviceLog(),
                permission: 'serviceLog',
            },
            { title: 'Log job', href: logJob(), permission: 'serviceLog' },
        ],
    },
    {
        title: 'Inspections',
        icon: ClipboardCheck,
        items: [
            {
                title: 'Checklists',
                href: inspections(),
                permission: 'inspections',
            },
            { title: 'Schedule', href: schedule(), permission: 'schedule' },
        ],
    },
    {
        title: 'Parts',
        icon: Package,
        items: [
            { title: 'Inventory', href: inventory(), permission: 'inventory' },
            {
                title: 'Shopping list',
                href: shoppingList(),
                permission: 'shoppingList',
            },
            {
                title: 'Receive parts',
                href: receiving(),
                permission: 'receiving',
            },
        ],
    },
    {
        title: 'Assistant',
        href: assistant(),
        icon: Bot,
        permission: 'assistant',
    },
];

/**
 * VDK-Equipment and VDK Equipment USA: picked from the brand switcher, in
 * place of Kaleb's Shop above, each with the same nav. Each has its own
 * equipment, checklists, job queue, service log and maintenance schedule,
 * kept apart from the other division's and from Kaleb's Shop's vehicle
 * jobs. The parts catalogue stays out: equipment jobs don't draw from shelf
 * stock.
 */
function equipmentNavItems(
    division: EquipmentDivision,
    permission: keyof Auth['can'],
): NavSection[] {
    const routes = divisionRoutes[division];

    return [
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutGrid,
            permission: 'mechanicsShop',
        },
        {
            title: 'Equipment',
            icon: Cog,
            items: [
                { title: 'Equipment', href: routes.index(), permission },
                {
                    title: 'Maintenance schedule',
                    href: routes.schedule(),
                    permission,
                },
            ],
        },
        {
            title: 'Service',
            icon: Wrench,
            items: [
                { title: 'Job queue', href: routes.jobQueue(), permission },
                { title: 'Service log', href: routes.serviceLog(), permission },
            ],
        },
        {
            title: 'Inspections',
            icon: ClipboardCheck,
            items: [
                { title: 'Checklists', href: routes.checklists(), permission },
            ],
        },
        {
            title: 'Assistant',
            href: assistant(),
            icon: Bot,
            permission: 'assistant',
        },
    ];
}

/**
 * Each workspace in the order the brand switcher lists it, the permission
 * that unlocks it, and its nav.
 */
const workspaceNav: Record<
    Workspace,
    { permission: keyof Auth['can']; items: NavSection[] }
> = {
    mechanics: { permission: 'mechanicsShop', items: mechanicsNavItems },
    equipment: {
        permission: 'equipment',
        items: equipmentNavItems('main', 'equipment'),
    },
    'equipment-usa': {
        permission: 'equipmentUsa',
        items: equipmentNavItems('usa', 'equipmentUsa'),
    },
};

const adminNavItems: NavLeaf[] = [
    { title: 'Team', href: team(), icon: Users, permission: 'manageTeam' },
];

/** Schedulers only have the schedule. */
const schedulerNavItems: NavLeaf[] = [
    {
        title: 'Schedule',
        href: schedule(),
        icon: CalendarCheck,
        permission: 'schedule',
    },
];

/** Shoppers only have the shopping list. */
const shopperNavItems: NavLeaf[] = [
    {
        title: 'Shopping list',
        href: shoppingList(),
        icon: ShoppingCart,
        permission: 'shoppingList',
    },
];

/** Keep a section's link, or a group's items, the account has permission for. */
function visibleSections(sections: NavSection[], can: Auth['can']): NavEntry[] {
    return sections.flatMap((section): NavEntry[] => {
        if ('items' in section) {
            const items = section.items.filter(
                (item) => !item.permission || can[item.permission],
            );

            return items.length > 0 ? [{ ...section, items }] : [];
        }

        return !section.permission || can[section.permission] ? [section] : [];
    });
}

export function AppSidebar() {
    const { auth } = usePage().props;
    const picked = useWorkspace();

    // Kaleb's Shop, VDK-Equipment and VDK Equipment USA are each unlocked
    // by their own permission, independently of the others, so an account
    // can hold any mix of them, or none. The one picked last stays put
    // while the account can still open it.
    const workspaces = (Object.keys(workspaceNav) as Workspace[]).filter(
        (workspace) => auth.can[workspaceNav[workspace].permission],
    );
    const workspace = workspaces.includes(picked) ? picked : workspaces.at(0);

    let roleNavItems: NavSection[];

    if (workspace) {
        roleNavItems = workspaceNav[workspace].items;
    } else if (auth.can.schedule) {
        roleNavItems = schedulerNavItems;
    } else {
        roleNavItems = shopperNavItems;
    }

    const items = visibleSections(
        [...roleNavItems, ...adminNavItems],
        auth.can,
    );

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <AppBrandSwitcher
                            workspaces={workspaces}
                            current={workspace}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={items} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
