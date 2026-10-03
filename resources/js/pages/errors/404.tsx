import { Head } from '@inertiajs/react';
import { Bot, Wrench } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';

/**
 * The shop's robot, caught mid-repair on a page that was not there to fix.
 * Built from a couple of lucide glyphs plus a small hand-drawn body, so it
 * never depends on an external image.
 */
function RobotMascot() {
    return (
        <div className="relative h-[220px] w-[240px] shrink-0" aria-hidden="true">
            <svg
                viewBox="0 0 200 180"
                className="absolute inset-0 h-full w-full"
            >
                <line
                    x1="100"
                    y1="20"
                    x2="100"
                    y2="6"
                    className="stroke-brand-navy dark:stroke-white"
                    strokeOpacity="0.6"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                <circle cx="100" cy="4" r="4" className="fill-brand-orange animate-pulse" />
                <rect
                    x="58"
                    y="96"
                    width="84"
                    height="56"
                    rx="18"
                    className="fill-brand-navy/5 stroke-brand-navy dark:fill-white/10 dark:stroke-white"
                    strokeOpacity="0.4"
                    strokeWidth="2"
                />
                <rect x="82" y="112" width="36" height="24" rx="6" className="fill-brand-orange" />
                <rect
                    x="46"
                    y="104"
                    width="13"
                    height="40"
                    rx="6"
                    className="fill-brand-navy/10 dark:fill-white/20"
                />
                <line
                    x1="140"
                    y1="112"
                    x2="166"
                    y2="92"
                    className="stroke-brand-navy dark:stroke-white"
                    strokeOpacity="0.4"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
            </svg>

            <Bot
                className="text-brand-navy absolute size-20 dark:text-white"
                style={{ left: '60px', top: '14px' }}
                strokeWidth={1.5}
            />

            <Wrench
                className="animate-wrench text-brand-orange absolute size-14"
                style={{ left: '136px', top: '58px', transformOrigin: '30% 70%' }}
                strokeWidth={1.75}
            />
        </div>
    );
}

export default function NotFound() {
    return (
        <>
            <Head title="Page not found" />

            <div className="flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
                <header className="mx-auto w-full max-w-5xl px-6 py-8">
                    <div className="flex items-center gap-2">
                        <AppLogoIcon className="text-brand-navy size-6 fill-current dark:text-white" />
                        <AppWordmark className="h-4" />
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-12 sm:flex-row sm:gap-16">
                    <RobotMascot />

                    <div className="max-w-md text-center sm:text-left">
                        <h1 className="text-3xl leading-tight font-black tracking-tight uppercase sm:text-4xl">
                            Well, that&rsquo;s not in stock.
                        </h1>
                        <p className="mt-4 text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                            You&rsquo;ve hit a 404 error.
                        </p>
                        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                            Whatever you were looking for isn&rsquo;t on the
                            shelf, and our robot&rsquo;s wrench won&rsquo;t fix
                            that.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
