import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';

export default function AppLogo() {
    return (
        <>
            <div className="bg-brand-navy ring-brand-orange ring-offset-sidebar flex aspect-square size-8 items-center justify-center rounded-lg text-white ring-1 ring-offset-2">
                <AppLogoIcon className="size-6 fill-current" />
            </div>
            <div className="ml-2 grid flex-1 gap-0.5 text-left">
                <AppWordmark className="h-3.5" />
                <span className="text-muted-foreground truncate text-[10px] leading-tight tracking-[0.2em] uppercase">
                    &mdash; Service log &mdash;
                </span>
            </div>
        </>
    );
}
