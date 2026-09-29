import { Link, usePage } from '@inertiajs/react';
import {
    Bot,
    CalendarCheck,
    Car,
    ClipboardCheck,
    LayoutGrid,
    Package,
    ShoppingCart,
    Users,
    Wrench,
} from 'lucide-react';
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
import { assistant, dashboard, diagnose, lookup } from '@/routes';
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
import type { NavEntry, NavItem } from '@/types';

const mainNavItems: NavEntry[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Fleet',
        icon: Car,
        items: [
            { title: 'Vehicles', href: vehicles() },
            { title: 'Lookup', href: lookup() },
        ],
    },
    {
        title: 'Service',
        icon: Wrench,
        items: [
            { title: 'Diagnose', href: diagnose() },
            { title: 'Service log', href: serviceLog() },
            { title: 'Log job', href: logJob() },
        ],
    },
    {
        title: 'Inspections',
        icon: ClipboardCheck,
        items: [
            { title: 'Checklists', href: inspections() },
            { title: 'Schedule', href: schedule() },
        ],
    },
    {
        title: 'Parts',
        icon: Package,
        items: [
            { title: 'Inventory', href: inventory() },
            { title: 'Shopping list', href: shoppingList() },
            { title: 'Receive parts', href: receiving() },
        ],
    },
    {
        title: 'Assistant',
        href: assistant(),
        icon: Bot,
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Team',
        href: team(),
        icon: Users,
    },
];

/** Schedulers only have the schedule. */
const schedulerNavItems: NavItem[] = [
    {
        title: 'Schedule',
        href: schedule(),
        icon: CalendarCheck,
    },
];

/** Shoppers only have the shopping list. */
const shopperNavItems: NavItem[] = [
    {
        title: 'Shopping list',
        href: shoppingList(),
        icon: ShoppingCart,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;

    const roleNavItems = auth.can.workOnRecords
        ? mainNavItems
        : auth.can.manageSchedule
          ? schedulerNavItems
          : shopperNavItems;

    const items = [
        ...roleNavItems,
        ...(auth.can.manageTeam ? adminNavItems : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
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
