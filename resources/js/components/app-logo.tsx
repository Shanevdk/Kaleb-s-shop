import { usePage } from "@inertiajs/react";

import AppLogoIcon from "@/components/app-logo-icon";

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground ring-sidebar-primary/25 ring-offset-sidebar flex aspect-square size-8 items-center justify-center rounded-full ring-1 ring-offset-2">
                <AppLogoIcon className="size-5 fill-current" />
            </div>
            <div className="ml-2 grid flex-1 text-left">
                <span className="truncate text-sm leading-tight font-bold tracking-[0.18em] uppercase">
                    {name}
                </span>
                <span className="text-muted-foreground truncate text-[10px] leading-tight tracking-[0.2em] uppercase">
                    &mdash; Service log &mdash;
                </span>
            </div>
        </>
    );
}
