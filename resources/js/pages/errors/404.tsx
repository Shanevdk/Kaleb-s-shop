import { Head } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';

/**
 * The lucide wrench glyph, drawn on a 24 by 24 grid.
 */
const WRENCH_PATH =
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';

/**
 * The shop's robot, caught mid-repair on a page that was not there to fix:
 * one drawing, so the head, body, arms and wrench all line up. It blinks,
 * and works the wrench from the shoulder.
 */
function RobotMascot() {
    const outline =
        'stroke-brand-navy dark:stroke-neutral-200 [stroke-linecap:round] [stroke-linejoin:round]';
    const panel = 'fill-white dark:fill-neutral-900';

    return (
        <svg
            viewBox="0 0 260 240"
            className="h-[250px] w-[270px] shrink-0"
            aria-hidden="true"
        >
            <ellipse
                cx="122"
                cy="226"
                rx="64"
                ry="7"
                className="fill-brand-navy/10 dark:fill-white/10"
            />

            {/* Antenna */}
            <line
                x1="122"
                y1="54"
                x2="122"
                y2="32"
                strokeWidth="4"
                className={outline}
            />
            <circle
                cx="122"
                cy="25"
                r="8"
                className="fill-brand-orange motion-safe:animate-pulse"
            />

            {/* Legs and feet */}
            <rect
                x="100"
                y="196"
                width="12"
                height="16"
                rx="3"
                className="fill-brand-navy dark:fill-neutral-200"
            />
            <rect
                x="132"
                y="196"
                width="12"
                height="16"
                rx="3"
                className="fill-brand-navy dark:fill-neutral-200"
            />
            <rect
                x="90"
                y="208"
                width="28"
                height="12"
                rx="6"
                className="fill-brand-navy dark:fill-neutral-200"
            />
            <rect
                x="126"
                y="208"
                width="28"
                height="12"
                rx="6"
                className="fill-brand-navy dark:fill-neutral-200"
            />

            {/* Arm hanging at its side */}
            <path
                d="M84 150 C 68 160, 62 172, 62 186"
                fill="none"
                strokeWidth="9"
                className={outline}
            />
            <circle
                cx="62"
                cy="190"
                r="9"
                strokeWidth="4"
                className={`${panel} ${outline}`}
            />

            {/* Arm working the wrench, swinging from the shoulder */}
            <g
                className="motion-safe:animate-wrench"
                style={{ transformOrigin: '160px 150px' }}
            >
                <path
                    d="M160 150 C 176 144, 186 134, 192 122"
                    fill="none"
                    strokeWidth="9"
                    className={outline}
                />
                <path
                    d={WRENCH_PATH}
                    transform="translate(185 66) scale(2.5)"
                    fill="none"
                    strokeWidth="1.6"
                    className="stroke-brand-orange [stroke-linecap:round] [stroke-linejoin:round]"
                />
                <circle
                    cx="193"
                    cy="120"
                    r="9"
                    strokeWidth="4"
                    className={`${panel} ${outline}`}
                />
            </g>

            {/* Body */}
            <rect
                x="80"
                y="134"
                width="84"
                height="66"
                rx="20"
                strokeWidth="4"
                className={`${panel} ${outline}`}
            />
            <rect
                x="102"
                y="152"
                width="40"
                height="26"
                rx="7"
                className="fill-brand-orange"
            />
            <circle cx="114" cy="165" r="3" className="fill-white/90" />
            <circle cx="122" cy="165" r="3" className="fill-white/60" />
            <circle cx="130" cy="165" r="3" className="fill-white/30" />

            {/* Neck */}
            <rect
                x="112"
                y="122"
                width="20"
                height="14"
                rx="3"
                className="fill-brand-navy dark:fill-neutral-200"
            />

            {/* Head */}
            <rect
                x="60"
                y="78"
                width="10"
                height="26"
                rx="4"
                className="fill-brand-navy dark:fill-neutral-200"
            />
            <rect
                x="174"
                y="78"
                width="10"
                height="26"
                rx="4"
                className="fill-brand-navy dark:fill-neutral-200"
            />
            <rect
                x="70"
                y="54"
                width="104"
                height="72"
                rx="24"
                strokeWidth="4"
                className={`${panel} ${outline}`}
            />
            <rect
                x="84"
                y="68"
                width="76"
                height="42"
                rx="16"
                className="fill-brand-navy dark:fill-neutral-800"
            />
            <g
                className="motion-safe:animate-blink"
                style={{ transformOrigin: '122px 89px' }}
            >
                <rect
                    x="100"
                    y="80"
                    width="10"
                    height="18"
                    rx="5"
                    className="fill-white"
                />
                <rect
                    x="134"
                    y="80"
                    width="10"
                    height="18"
                    rx="5"
                    className="fill-white"
                />
            </g>
        </svg>
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

                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-12 sm:flex-row sm:gap-20">
                    <RobotMascot />

                    <div className="text-center sm:text-left">
                        <p className="text-neutral-700 dark:text-neutral-300">
                            Page not found
                        </p>
                        <h1 className="mt-8 text-4xl leading-none font-bold tracking-tight uppercase sm:text-5xl">
                            Well, that&rsquo;s not stock.
                        </h1>
                        <p className="mt-4 text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                            You&rsquo;ve hit a 404 error.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
