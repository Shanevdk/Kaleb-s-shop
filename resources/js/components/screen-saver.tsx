import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import {
    screenSaverPreviewEvent,
    useScreenSaver,
} from '@/hooks/use-screen-saver';
import type { ScreenSaverSettings } from '@/hooks/use-screen-saver';
import { cn } from '@/lib/utils';

const shopTimeZone = 'America/Toronto';

/** Anything that counts as someone using the app. */
const activityEvents = [
    'pointerdown',
    'pointermove',
    'keydown',
    'wheel',
    'touchstart',
    'scroll',
    'dragover',
] as const;

/** How far the mouse has to travel to wake the screen, so a nudge doesn't. */
const wakeDistance = 12;

/**
 * A clock that drops down over the app after a while with nobody using it,
 * and goes back up at the first tap, click or key press.
 */
export default function ScreenSaver() {
    const settings = useScreenSaver();
    const { name } = usePage().props;
    const [active, setActive] = useState(false);
    const activeRef = useRef(false);
    const timer = useRef<number | undefined>(undefined);

    const arm = useCallback(() => {
        window.clearTimeout(timer.current);

        if (settings.enabled) {
            timer.current = window.setTimeout(() => {
                activeRef.current = true;
                setActive(true);
            }, settings.minutes * 60_000);
        }
    }, [settings.enabled, settings.minutes]);

    const wake = useCallback(() => {
        activeRef.current = false;
        setActive(false);
        arm();
    }, [arm]);

    // Count down from the last time anyone used the app.
    useEffect(() => {
        const onActivity = () => {
            if (!activeRef.current) {
                arm();
            }
        };

        arm();
        activityEvents.forEach((event) =>
            window.addEventListener(event, onActivity, {
                passive: true,
                capture: true,
            }),
        );

        return () => {
            window.clearTimeout(timer.current);
            activityEvents.forEach((event) =>
                window.removeEventListener(event, onActivity, {
                    capture: true,
                }),
            );
        };
    }, [arm]);

    // The settings page can drop it down to try it out.
    useEffect(() => {
        const preview = () => {
            window.clearTimeout(timer.current);
            activeRef.current = true;
            setActive(true);
        };

        window.addEventListener(screenSaverPreviewEvent, preview);

        return () =>
            window.removeEventListener(screenSaverPreviewEvent, preview);
    }, []);

    // While it is down, any key wakes the app without typing into it.
    useEffect(() => {
        if (!active) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            wake();
        };

        window.addEventListener('keydown', onKey, { capture: true });

        return () =>
            window.removeEventListener('keydown', onKey, { capture: true });
    }, [active, wake]);

    const pointerStart = useRef<{ x: number; y: number } | null>(null);

    return (
        <div
            role="dialog"
            aria-modal={active}
            aria-label="Screen saver"
            aria-hidden={!active}
            inert={!active}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                wake();
            }}
            onPointerMove={(event) => {
                if (pointerStart.current === null) {
                    pointerStart.current = {
                        x: event.clientX,
                        y: event.clientY,
                    };

                    return;
                }

                const moved = Math.hypot(
                    event.clientX - pointerStart.current.x,
                    event.clientY - pointerStart.current.y,
                );

                if (moved > wakeDistance) {
                    pointerStart.current = null;
                    wake();
                }
            }}
            onPointerLeave={() => (pointerStart.current = null)}
            className={cn(
                'bg-brand-navy fixed inset-0 z-[100] flex cursor-none flex-col items-center justify-center overflow-hidden text-white shadow-2xl transition-transform duration-700 ease-out select-none motion-reduce:transition-none',
                active
                    ? 'translate-y-0'
                    : 'pointer-events-none -translate-y-full',
            )}
        >
            {active && <Clock settings={settings} shopName={name} />}

            <div className="bg-brand-orange absolute inset-x-0 bottom-0 h-1.5" />
            <p className="absolute bottom-8 text-xs tracking-[0.3em] text-white/50 uppercase">
                Tap anywhere to carry on
            </p>
        </div>
    );
}

function Clock({
    settings,
    shopName,
}: {
    settings: ScreenSaverSettings;
    shopName: string;
}) {
    const [now, setNow] = useState(() => new Date());
    const [drift, setDrift] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const tick = window.setInterval(() => setNow(new Date()), 1000);

        return () => window.clearInterval(tick);
    }, []);

    // Wander a little every minute so nothing burns into the screen.
    useEffect(() => {
        const wander = window.setInterval(
            () =>
                setDrift({
                    x: Math.round((Math.random() - 0.5) * 80),
                    y: Math.round((Math.random() - 0.5) * 60),
                }),
            60_000,
        );

        return () => window.clearInterval(wander);
    }, []);

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: shopTimeZone,
        hour: 'numeric',
        minute: '2-digit',
        second: settings.showSeconds ? '2-digit' : undefined,
        hourCycle: settings.clock === '24h' ? 'h23' : 'h12',
    }).formatToParts(now);

    const time = parts
        .filter((part) => part.type !== 'dayPeriod')
        .map((part) => part.value)
        .join('')
        .trim();
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value;

    const date = now.toLocaleDateString('en-US', {
        timeZone: shopTimeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div
            className="flex flex-col items-center gap-4 px-6 text-center transition-transform duration-[3000ms] ease-in-out"
            style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
        >
            <div className="bg-brand-navy ring-brand-orange flex size-14 items-center justify-center rounded-2xl ring-2 ring-offset-4 ring-offset-transparent">
                <AppLogoIcon className="size-10 fill-current" />
            </div>

            <p className="flex items-baseline gap-3 font-light tabular-nums">
                <span className="text-[clamp(4rem,16vw,12rem)] leading-none tracking-tight">
                    {time}
                </span>
                {dayPeriod && (
                    <span className="text-brand-orange text-[clamp(1.25rem,4vw,3rem)] font-medium">
                        {dayPeriod}
                    </span>
                )}
            </p>

            {settings.showDate && (
                <p className="text-[clamp(1rem,3vw,1.75rem)] text-white/80">
                    {date}
                </p>
            )}

            <p className="text-sm tracking-[0.3em] text-white/40 uppercase">
                {shopName}
            </p>
        </div>
    );
}
