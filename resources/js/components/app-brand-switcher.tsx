import { router } from '@inertiajs/react';
import { Check, ChevronsUpDown, Cog } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { setWorkspace, useWorkspace } from '@/hooks/use-workspace';
import { dashboard } from '@/routes';
import { index as equipmentIndex } from '@/routes/equipment';

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
                    <span className="text-brand-navy dark:text-white">
                        VDK
                    </span>{' '}
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
 * Switch between the vehicle-focused shop and VDK-Equipment, each with its
 * own nav underneath. Picked here, it holds on this device until changed
 * again, the same way the screen saver settings do.
 */
export default function AppBrandSwitcher() {
    const workspace = useWorkspace();

    const choose = (next: typeof workspace, href: string) => {
        setWorkspace(next);
        router.visit(href);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" data-test="brand-switcher-button">
                    {workspace === 'equipment' ? <EquipmentBrand /> : (
                        <AppLogo />
                    )}
                    <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
            >
                <DropdownMenuLabel>Switch to</DropdownMenuLabel>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => choose('mechanics', dashboard().url)}
                >
                    Kaleb's Shop
                    {workspace === 'mechanics' && (
                        <Check className="ml-auto size-4" />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                        choose('equipment', equipmentIndex().url)
                    }
                >
                    VDK-Equipment
                    {workspace === 'equipment' && (
                        <Check className="ml-auto size-4" />
                    )}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
