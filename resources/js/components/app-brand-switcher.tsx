import { Link, router } from '@inertiajs/react';
import { Check, ChevronsUpDown, Cog } from 'lucide-react';
import AmericanFlag from '@/components/american-flag';
import AppLogo from '@/components/app-logo';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { setWorkspace } from '@/hooks/use-workspace';
import type { Workspace } from '@/hooks/use-workspace';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { dashboard } from '@/routes';

/**
 * The equipment brand, shown in place of "Kaleb's Shop" once that workspace
 * is picked. There is no drawn wordmark for it, so the name is set in plain
 * text to match the weight and colours of the real one.
 */
export function EquipmentBrand() {
    return (
        <>
            <div className="bg-brand-navy ring-brand-orange ring-offset-sidebar flex aspect-square size-8 items-center justify-center rounded-lg text-white ring-1 ring-offset-2">
                <Cog className="size-5" />
            </div>
            <div className="ml-2 grid flex-1 gap-0.5 text-left">
                <span className="text-sm leading-none font-black italic">
                    <span className="text-brand-navy dark:text-white">VDK</span>{' '}
                    <span className="text-brand-orange">Equipment</span>
                </span>
                <span className="text-muted-foreground truncate text-[10px] leading-tight tracking-[0.2em] uppercase">
                    &mdash; Equipment log &mdash;
                </span>
            </div>
        </>
    );
}

/**
 * VDK Equipment USA's brand: VDK-Equipment's, with the American flag in
 * place of the cog and USA after the name, set a touch tighter so the
 * longer name still fits on one line beside the switcher's arrows.
 */
export function EquipmentUsaBrand() {
    return (
        <>
            <div className="ring-brand-orange ring-offset-sidebar flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg ring-1 ring-offset-2">
                <AmericanFlag className="size-full" />
            </div>
            <div className="ml-2 grid flex-1 gap-0.5 text-left">
                <span className="text-sm leading-none font-black tracking-tight italic">
                    <span className="text-brand-navy dark:text-white">VDK</span>{' '}
                    <span className="text-brand-orange">Equipment</span>{' '}
                    <span className="text-brand-navy dark:text-white">USA</span>
                </span>
                <span className="text-muted-foreground truncate text-[10px] leading-tight tracking-[0.2em] uppercase">
                    &mdash; Equipment log &mdash;
                </span>
            </div>
        </>
    );
}

/** Each workspace's name, its brand, and the page it opens on. */
const workspaceDetails = {
    mechanics: { label: "Kaleb's Shop", Brand: AppLogo, home: dashboard },
    equipment: {
        label: 'VDK-Equipment',
        Brand: EquipmentBrand,
        home: divisionRoutes.main.index,
    },
    'equipment-usa': {
        label: 'VDK Equipment USA',
        Brand: EquipmentUsaBrand,
        home: divisionRoutes.usa.index,
    },
} satisfies Record<Workspace, unknown>;

/**
 * The brand at the top of the sidebar. An account that can open more than
 * one of Kaleb's Shop, VDK-Equipment and VDK Equipment USA switches between
 * them here, each with its own nav underneath; picked here, it holds on this
 * device until changed again, the same way the screen saver settings do.
 * Anyone else gets their own workspace's brand, or Kaleb's Shop's when they
 * have none.
 */
export default function AppBrandSwitcher({
    workspaces,
    current,
}: {
    workspaces: Workspace[];
    current?: Workspace;
}) {
    const { Brand, home } = workspaceDetails[current ?? 'mechanics'];

    if (workspaces.length < 2) {
        return (
            <SidebarMenuButton size="lg" asChild>
                <Link href={home()} prefetch>
                    <Brand />
                </Link>
            </SidebarMenuButton>
        );
    }

    const choose = (next: Workspace) => {
        setWorkspace(next);
        router.visit(workspaceDetails[next].home().url);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" data-test="brand-switcher-button">
                    <Brand />
                    <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
            >
                <DropdownMenuLabel>Switch to</DropdownMenuLabel>
                {workspaces.map((workspace) => (
                    <DropdownMenuItem
                        key={workspace}
                        className="cursor-pointer"
                        onClick={() => choose(workspace)}
                    >
                        {workspaceDetails[workspace].label}
                        {workspace === current && (
                            <Check className="ml-auto size-4" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
