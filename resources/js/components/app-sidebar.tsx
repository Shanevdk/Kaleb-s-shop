import { Link, usePage } from '@inertiajs/react';
import {
    Bot,
    Car,
    ClipboardCheck,
    LayoutGrid,
    Package,
    PlusCircle,
    ScanSearch,
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
import { assistant, dashboard, lookup } from '@/routes';
import {
    create as logJob,
    index as serviceLog,
} from '@/routes/service-records';
import { index as inspections } from '@/routes/inspections';
import { index as inventory } from '@/routes/inventory';
import { index as shoppingList } from '@/routes/shopping-list';
import { index as team } from '@/routes/admin/users';
import { index as vehicles } from '@/routes/vehicles';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Vehicles',
        href: vehicles(),
        icon: Car,
    },
    {
        title: 'Lookup',
        href: lookup(),
        icon: ScanSearch,
    },
    {
        title: 'Service log',
        href: serviceLog(),
        icon: Wrench,
    },
    {
        title: 'Checklists',
        href: inspections(),
        icon: ClipboardCheck,
    },
    {
        title: 'Inventory',
        href: inventory(),
        icon: Package,
    },
    {
        title: 'Shopping list',
        href: shoppingList(),
        icon: ShoppingCart,
    },
    {
        title: 'Assistant',
        href: assistant(),
        icon: Bot,
    },
    {
        title: 'Log job',
        href: logJob(),
        icon: PlusCircle,
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Team',
        href: team(),
        icon: Users,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;

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
                <NavMain
                    items={
                        auth.isAdmin
                            ? [...mainNavItems, ...adminNavItems]
                            : mainNavItems
                    }
                />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
