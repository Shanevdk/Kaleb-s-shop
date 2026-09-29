import { Head, Link, usePage } from '@inertiajs/react';
import {
    Car,
    ClipboardList,
    Clock,
    FastForward,
    Gauge,
    RotateCcw,
    ShieldCheck,
    Volume2,
    VolumeX,
    Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';
import { cn } from '@/lib/utils';
import { dashboard, login } from '@/routes';

const features = [
    {
        icon: Car,
        title: 'Your fleet, on file',
        description:
            'Add every machine once — make, model, year, plate, VIN, odometer — and keep it all in one place.',
    },
    {
        icon: ClipboardList,
        title: 'Every job logged',
        description:
            'Record what you did, the parts you fitted and the notes the next mechanic will need.',
    },
    {
        icon: Clock,
        title: 'Hours and cost',
        description:
            'Track labour hours, parts and labour cost per job, then see the running total per vehicle.',
    },
    {
        icon: Gauge,
        title: 'Full service history',
        description:
            'Filter the log by vehicle or status and pull up a complete history in seconds.',
    },
];

export default function Welcome() {
    const { auth, name } = usePage().props;

    return (
        <>
            <Head title="Workshop records, done properly" />

            <div className="flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
                <header className="bg-brand-navy text-white">
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                            <span className="ring-brand-orange ring-offset-brand-navy flex size-9 items-center justify-center rounded-lg ring-1 ring-offset-2">
                                <AppLogoIcon className="size-7 fill-current" />
                            </span>
                            <AppWordmark className="h-5" onDark />
                        </div>

                        <nav className="flex items-center gap-2 text-sm">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="bg-brand-orange rounded-md px-4 py-2 font-medium text-white transition-colors hover:bg-[#d8461a]"
                            >
                                {auth.user ? 'Dashboard' : 'Log in'}
                            </Link>
                        </nav>
                    </div>
                </header>

                <main className="flex-1">
                    <IntroHero
                        isSignedIn={Boolean(auth.user)}
                        shopName={name}
                    />

                    <section className="border-t border-neutral-200 dark:border-neutral-800">
                        <div className="mx-auto grid w-full max-w-6xl gap-px bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4 dark:bg-neutral-800">
                            {features.map((feature) => (
                                <article
                                    key={feature.title}
                                    className="bg-white p-8 dark:bg-neutral-950"
                                >
                                    <feature.icon className="text-brand-orange size-5" />
                                    <h2 className="mt-4 font-semibold">
                                        {feature.title}
                                    </h2>
                                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        {feature.description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="mx-auto w-full max-w-6xl px-6 py-20">
                        <div className="bg-brand-navy flex flex-col items-start gap-6 rounded-2xl p-10 text-white sm:flex-row sm:items-center sm:justify-between">
                            <div className="max-w-xl space-y-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Stop keeping the history in your head.
                                </h2>
                                <p className="flex items-center gap-2 text-sm text-white/70">
                                    <ShieldCheck className="size-4" />
                                    Your records, your account, private by
                                    default.
                                </p>
                            </div>
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="bg-brand-orange inline-flex shrink-0 items-center gap-2 rounded-md px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#d8461a]"
                            >
                                {auth.user ? 'Go to dashboard' : 'Log in'}
                            </Link>
                        </div>
                    </section>
                </main>

                <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
                    <div className="mx-auto w-full max-w-6xl px-6 text-xs tracking-widest text-neutral-500 uppercase">
                        {name} — workshop service records
                    </div>
                </footer>
            </div>
        </>
    );
}

/**
 * The shop's intro video, framed and glowing like a welding spark. When it
 * lands on the logo, the headline and buttons slide in underneath. Anyone who
 * asked for reduced motion, or whose browser will not autoplay, gets the
 * finished logo frame straight away.
 */
function IntroHero({
    isSignedIn,
    shopName,
}: {
    isSignedIn: boolean;
    shopName: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [revealed, setRevealed] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);

    useEffect(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setRevealed(true);

            return;
        }

        video.muted = true;
        video.play().catch(() => setRevealed(true));

        // Never hold the page back if the video stalls.
        const fallback = window.setTimeout(() => setRevealed(true), 17000);

        return () => window.clearTimeout(fallback);
    }, []);

    const replay = (withSound: boolean) => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        video.muted = !withSound;
        setMuted(!withSound);
        video.currentTime = 0;
        video.play().catch(() => setRevealed(true));
    };

    const skip = () => {
        const video = videoRef.current;

        if (video && Number.isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.duration - 0.05);
        }

        setRevealed(true);
    };

    const toggleSound = () => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (!playing) {
            replay(true);

            return;
        }

        video.muted = !video.muted;
        setMuted(video.muted);
    };

    return (
        <section className="bg-brand-navy relative overflow-hidden text-white">
            {/* Spark glow behind the frame. */}
            <div
                aria-hidden
                className="bg-brand-orange/25 pointer-events-none absolute top-1/4 left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.45))]"
            />

            <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
                <div className="group relative w-full max-w-4xl">
                    <div className="ring-brand-orange/60 shadow-brand-orange/20 overflow-hidden rounded-2xl bg-black shadow-2xl ring-1">
                        <video
                            ref={videoRef}
                            className="aspect-[736/400] w-full"
                            poster="/brand/kalebs-shop-poster.jpg"
                            playsInline
                            muted
                            preload="auto"
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                            onEnded={() => {
                                setPlaying(false);
                                setRevealed(true);
                            }}
                        >
                            <source
                                src="/brand/kalebs-shop-intro.mp4"
                                type="video/mp4"
                            />
                        </video>
                    </div>

                    <div className="absolute right-3 bottom-3 flex gap-2">
                        {playing && !revealed && (
                            <IntroButton onClick={skip} label="Skip intro">
                                <FastForward className="size-4" />
                            </IntroButton>
                        )}
                        <IntroButton
                            onClick={toggleSound}
                            label={
                                muted ? 'Play with sound' : 'Turn the sound off'
                            }
                        >
                            {muted ? (
                                <VolumeX className="size-4" />
                            ) : (
                                <Volume2 className="size-4" />
                            )}
                        </IntroButton>
                        {!playing && (
                            <IntroButton
                                onClick={() => replay(!muted)}
                                label="Replay the intro"
                            >
                                <RotateCcw className="size-4" />
                            </IntroButton>
                        )}
                    </div>
                </div>

                <div
                    className={cn(
                        'mt-10 flex max-w-3xl flex-col items-center text-center transition-all duration-700 ease-out',
                        revealed
                            ? 'translate-y-0 opacity-100'
                            : 'pointer-events-none translate-y-6 opacity-0',
                    )}
                >
                    <p className="text-brand-orange text-xs font-semibold tracking-[0.3em] uppercase">
                        Workshop records
                    </p>
                    <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
                        Every job, every vehicle, written down properly.
                    </h1>
                    <p className="mt-5 max-w-xl text-lg text-white/75">
                        {shopName} keeps the service log for the person holding
                        the spanner. Add the vehicles you work on, log what you
                        did, and never guess when that belt was last changed.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href={isSignedIn ? dashboard() : login()}
                            className="bg-brand-orange shadow-brand-orange/30 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#d8461a]"
                        >
                            <Wrench className="size-4" />
                            {isSignedIn ? 'Open the workshop' : 'Log in'}
                        </Link>
                        {!isSignedIn && (
                            <span className="text-sm text-white/60">
                                Accounts are set up by the shop owner.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function IntroButton({
    onClick,
    label,
    children,
}: {
    onClick: () => void;
    label: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
        >
            {children}
        </button>
    );
}
