import { Link, usePage } from '@inertiajs/react';
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
import AppBrandSwitcher, {
    EquipmentBrand,
} from '@/components/app-brand-switcher';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useWorkspace } from '@/hooks/use-workspace';
import { assistant, dashboard, diagnose, lookup } from '@/routes';
import { index as equipment } from '@/routes/equipment';
import { index as equipmentSchedule } from '@/routes/equipment-schedule';
import { index as equipmentServiceLog } from '@/routes/equipment-service-records';
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
import type { Auth, NavEntry, NavItem } from '@/types';

/** A nav link that only shows up when the account holds its permission. */
type NavLeaf = NavItem & { permission?: keyof Auth['can'] };

/** A nav link on its own, or a collapsible group of them. */
type NavSection =
    | NavLeaf
    | { title: string; icon?: NavItem['icon']; items: NavLeaf[] };

/** Kaleb's Shop: the vehicle-focused side, picked from the brand switcher. */
const mechanicsNavItems: NavSection[] = [
    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid, permission: 'mechanicsShop' },
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
            { title: 'Service log', href: serviceLog(), permission: 'serviceLog' },
            { title: 'Log job', href: logJob(), permission: 'serviceLog' },
        ],
    },
    {
        title: 'Inspections',
        icon: ClipboardCheck,
        items: [
            { title: 'Checklists', href: inspections(), permission: 'inspections' },
            { title: 'Schedule', href: schedule(), permission: 'schedule' },
        ],
    },
    {
        title: 'Parts',
        icon: Package,
        items: [
            { title: 'Inventory', href: inventory(), permission: 'inventory' },
            { title: 'Shopping list', href: shoppingList(), permission: 'shoppingList' },
            { title: 'Receive parts', href: receiving(), permission: 'receiving' },
        ],
    },
    { title: 'Assistant', href: assistant(), icon: Bot, permission: 'assistant' },
];

/**
 * VDK-Equipment: picked from the brand switcher, in place of Kaleb's Shop
 * above. It carries its own copies of the job queue and checklists, since
 * equipment jobs are worked the same way vehicle jobs are, and its own
 * maintenance schedule, kept apart from the mechanics' vehicle schedule.
 * The parts catalogue stays out: equipment jobs don't draw from shelf stock.
 */
const equipmentNavItems: NavSection[] = [
    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid, permission: 'mechanicsShop' },
    {
        title: 'Equipment',
        icon: Cog,
        items: [
            { title: 'Equipment', href: equipment(), permission: 'equipment' },
            { title: 'Service log', href: equipmentServiceLog(), permission: 'equipment' },
            { title: 'Maintenance schedule', href: equipmentSchedule(), permission: 'equipment' },
        ],
    },
    {
        title: 'Service',
        icon: Wrench,
        items: [
            { title: 'Job queue', href: jobQueue(), permission: 'jobQueue' },
            { title: 'Log job', href: logJob(), permission: 'serviceLog' },
        ],
    },
    {
        title: 'Inspections',
        icon: ClipboardCheck,
        items: [
            { title: 'Checklists', href: inspections(), permission: 'inspections' },
        ],
    },
    { title: 'Assistant', href: assistant(), icon: Bot, permission: 'assistant' },
];

const adminNavItems: NavLeaf[] = [
    { title: 'Team', href: team(), icon: Users, permission: 'manageTeam' },
];

/** Schedulers only have the schedule. */
const schedulerNavItems: NavLeaf[] = [
    { title: 'Schedule', href: schedule(), icon: CalendarCheck, permission: 'schedule' },
];

/** Shoppers only have the shopping list. */
const shopperNavItems: NavLeaf[] = [
    { title: 'Shopping list', href: shoppingList(), icon: ShoppingCart, permission: 'shoppingList' },
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
    const { auth, pendingAccountCount } = usePage().props;
    const workspace = useWorkspace();

    // Kaleb's Shop and VDK-Equipment are each unlocked by their own
    // permission, independently of the other, so an account can hold
    // either, both or neither.
    const canMechanicsShop = auth.can.mechanicsShop;
    const canEquipment = auth.can.equipment;

    let roleNavItems: NavSection[];

    if (canMechanicsShop && canEquipment) {
        roleNavItems = workspace === 'equipment' ? equipmentNavItems : mechanicsNavItems;
    } else if (canMechanicsShop) {
        roleNavItems = mechanicsNavItems;
    } else if (canEquipment) {
        roleNavItems = equipmentNavItems;
    } else if (auth.can.schedule) {
        roleNavItems = schedulerNavItems;
    } else {
        roleNavItems = shopperNavItems;
    }

    // The Team link counts the sign-ups waiting to be accepted or declined.
    const items = visibleSections(
        [
            ...roleNavItems,
            ...adminNavItems.map((item) => ({
                ...item,
                badge: pendingAccountCount,
            })),
        ],
        auth.can,
    );

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        {canMechanicsShop && canEquipment ? (
                            <AppBrandSwitcher />
                        ) : canEquipment ? (
                            <SidebarMenuButton size="lg" asChild>
                                <Link href={equipment()} prefetch>
                                    <EquipmentBrand />
                                </Link>
                            </SidebarMenuButton>
                        ) : (
                            <SidebarMenuButton size="lg" asChild>
                                <Link href={dashboard()} prefetch>
                                    <AppLogo />
                                </Link>
                            </SidebarMenuButton>
                        )}
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
