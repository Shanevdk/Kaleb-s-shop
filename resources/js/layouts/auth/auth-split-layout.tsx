import { Link } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="relative grid h-dvh flex-col items-center justify-center px-8 sm:px-0 lg:max-w-none lg:grid-cols-2 lg:px-0">
            <ShopPanel />
            <div className="w-full lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <Link
                        href={home()}
                        className="relative z-20 flex flex-col items-center justify-center gap-3 lg:hidden"
                    >
                        <span className="bg-brand-charcoal text-brand-steel flex size-12 items-center justify-center rounded-xl">
                            <AppLogoIcon className="size-9 fill-current" />
                        </span>
                        <AppWordmark className="h-5" />
                    </Link>
                    <div className="flex flex-col items-start gap-2 text-left sm:items-center sm:text-center">
                        <h1 className="text-xl font-medium">{title}</h1>
                        <p className="text-muted-foreground text-sm text-balance">
                            {description}
                        </p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * The shop's intro video looping quietly beside the form. It stays on the
 * logo frame for anyone who asked for reduced motion.
 */
function ShopPanel() {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;

        if (
            !video ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        video.muted = true;
        video.play().catch(() => {
            // Autoplay blocked; the poster shows the logo instead.
        });
    }, []);

    return (
        <div className="bg-brand-navy relative hidden h-full flex-col overflow-hidden p-10 text-white lg:flex">
            <div
                aria-hidden
                className="bg-brand-orange/25 pointer-events-none absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            />

            <Link href={home()} className="relative z-20">
                <AppWordmark className="h-6" onDark />
            </Link>

            <div className="relative z-10 flex flex-1 items-center justify-center">
                <div className="ring-brand-orange/60 w-full max-w-xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1">
                    <video
                        ref={videoRef}
                        className="aspect-[736/400] w-full"
                        poster="/brand/kalebs-shop-poster.jpg"
                        playsInline
                        muted
                        loop
                        preload="auto"
                        aria-hidden
                    >
                        <source
                            src="/brand/kalebs-shop-intro.mp4"
                            type="video/mp4"
                        />
                    </video>
                </div>
            </div>

            <p className="relative z-20 text-sm text-white/70">
                Every job, every vehicle, written down properly.
            </p>
        </div>
    );
}
