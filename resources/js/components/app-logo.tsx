import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';

export default function AppLogo() {
    return (
        <>
            <div className="bg-brand-charcoal text-brand-steel flex aspect-square size-8 items-center justify-center rounded-lg">
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
