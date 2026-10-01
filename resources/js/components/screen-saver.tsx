import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';
import {
    screenSaverPreviewEvent,
    useScreenSaver,
} from '@/hooks/use-screen-saver';
import type { ScreenSaverSettings } from '@/hooks/use-screen-saver';
import { useScreenSaverData } from '@/hooks/use-screen-saver-data';
import type {
    ScreenSaverChecklist,
    ScreenSaverJob,
} from '@/hooks/use-screen-saver-data';
import { useScreenSaverImageUrls } from '@/hooks/use-screen-saver-images';
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

/**
 * Everything at once, dropped down over the app after a while with nobody
 * using it: the pictures fill the background, cross-fading from one to the
 * next, with the clock, today's jobs and the open checklists on top. It only
 * goes back up when it is deliberately tapped, clicked or a key is pressed -
 * not from a scroll, a drag or the mouse drifting.
 */
export default function ScreenSaver() {
    const settings = useScreenSaver();
    const [active, setActive] = useState(false);
    const activeRef = useRef(false);
    const timer = useRef<number | undefined>(undefined);

    const pictures = useScreenSaverImageUrls();
    const showPictures =
        settings.panels.includes('pictures') && pictures.length > 0;
    const showClock = settings.panels.includes('clock');
    const showSchedule = settings.panels.includes('schedule');
    const showChecklists = settings.panels.includes('checklists');
    const data = useScreenSaverData(active && (showSchedule || showChecklists));

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

    // Step through the background pictures while it is down.
    const [pictureIndex, setPictureIndex] = useState(0);

    useEffect(() => {
        if (!active || !showPictures) {
            setPictureIndex(0);

            return;
        }

        if (pictures.length <= 1) {
            return;
        }

        const step = window.setInterval(() => {
            setPictureIndex((index) => (index + 1) % pictures.length);
        }, settings.secondsPerPanel * 1000);

        return () => window.clearInterval(step);
    }, [active, showPictures, pictures.length, settings.secondsPerPanel]);

    // Wander a little every minute so nothing burns into the screen.
    const [drift, setDrift] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!active) {
            return;
        }

        const wander = window.setInterval(
            () =>
                setDrift({
                    x: Math.round((Math.random() - 0.5) * 24),
                    y: Math.round((Math.random() - 0.5) * 16),
                }),
            60_000,
        );

        return () => window.clearInterval(wander);
    }, [active]);

    const hasSidePanels = showSchedule || showChecklists;

    return (
        <div
            role="dialog"
            aria-modal={active}
            aria-label="Screen saver"
            aria-hidden={!active}
            inert={!active}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                wake();
            }}
            className={cn(
                'bg-brand-navy fixed inset-0 z-[100] cursor-pointer overflow-hidden text-white shadow-2xl transition-transform duration-700 ease-out select-none motion-reduce:transition-none',
                active
                    ? 'translate-y-0'
                    : 'pointer-events-none -translate-y-full',
            )}
        >
            {active && (
                <>
                    {showPictures && (
                        <Backdrop
                            urls={pictures.map((picture) => picture.url)}
                            current={pictureIndex % pictures.length}
                            seconds={settings.secondsPerPanel}
                        />
                    )}

                    <div
                        className="relative flex h-full w-full flex-col gap-6 overflow-y-auto p-6 transition-transform duration-[3000ms] ease-in-out sm:p-10"
                        style={{
                            transform: `translate(${drift.x}px, ${drift.y}px)`,
                        }}
                    >
                        <header className="flex items-center gap-3">
                            <span className="bg-brand-navy ring-brand-orange flex size-11 items-center justify-center rounded-xl ring-2 ring-offset-2 ring-offset-transparent">
                                <AppLogoIcon className="size-8 fill-current" />
                            </span>
                            <AppWordmark className="h-6 drop-shadow" onDark />
                        </header>

                        <div
                            className={cn(
                                'grid flex-1 items-center gap-8',
                                hasSidePanels &&
                                    'lg:grid-cols-[1fr_minmax(20rem,28rem)]',
                            )}
                        >
                            {showClock ? (
                                <Clock
                                    settings={settings}
                                    centred={!hasSidePanels}
                                />
                            ) : (
                                <div />
                            )}

                            {hasSidePanels && (
                                <div className="grid content-center gap-4">
                                    {showSchedule && (
                                        <SchedulePanel
                                            jobs={data?.jobsToday ?? null}
                                        />
                                    )}
                                    {showChecklists && (
                                        <ChecklistsPanel
                                            checklists={
                                                data?.checklistsInProgress ??
                                                null
                                            }
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="bg-brand-orange absolute inset-x-0 bottom-0 h-1.5" />
            <p className="absolute inset-x-0 bottom-4 text-center text-xs tracking-[0.3em] text-white/60 uppercase drop-shadow">
                Tap anywhere to carry on
            </p>
        </div>
    );
}

/**
 * The pictures filling the screen behind everything, each fading in over the
 * last with a slow zoom, under a tint so the writing on top stays readable.
 */
function Backdrop({
    urls,
    current,
    seconds,
}: {
    urls: string[];
    current: number;
    seconds: number;
}) {
    return (
        <div className="absolute inset-0" aria-hidden>
            {urls.map((url, index) => (
                <img
                    key={url}
                    src={url}
                    alt=""
                    className={cn(
                        'absolute inset-0 h-full w-full object-cover ease-linear motion-reduce:transition-none',
                        index === current
                            ? 'scale-110 opacity-100'
                            : 'scale-100 opacity-0',
                    )}
                    style={{
                        transitionProperty: 'opacity, transform',
                        transitionDuration: `1500ms, ${seconds * 1000 + 1500}ms`,
                    }}
                />
            ))}
            <div className="from-brand-navy/90 via-brand-navy/55 absolute inset-0 bg-gradient-to-r to-black/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </div>
    );
}

/**
 * A see-through card for the panels sitting over the pictures.
 */
function Card({ heading, children }: { heading: string; children: ReactNode }) {
    return (
        <section className="space-y-3 rounded-2xl border border-white/15 bg-black/35 p-5 shadow-xl backdrop-blur-md">
            <p className="text-brand-orange text-sm font-semibold tracking-[0.3em] uppercase">
                {heading}
            </p>
            {children}
        </section>
    );
}

function SchedulePanel({ jobs }: { jobs: ScreenSaverJob[] | null }) {
    return (
        <Card heading="Today’s jobs">
            {jobs === null ? null : jobs.length === 0 ? (
                <p className="text-white/70">Nothing booked in for today.</p>
            ) : (
                <ul className="space-y-2">
                    {jobs.slice(0, 5).map((job) => (
                        <li
                            key={job.id}
                            className="flex items-center justify-between gap-4 rounded-lg bg-white/10 px-4 py-2.5"
                        >
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    {job.title}
                                </p>
                                {job.vehicle && (
                                    <p className="truncate text-sm text-white/60">
                                        {job.vehicle}
                                    </p>
                                )}
                            </div>
                            <span className="text-brand-orange shrink-0 text-xs tracking-wide uppercase">
                                {job.status.replace('_', ' ')}
                            </span>
                        </li>
                    ))}
                    {jobs.length > 5 && (
                        <li className="text-sm text-white/60">
                            and {jobs.length - 5} more
                        </li>
                    )}
                </ul>
            )}
        </Card>
    );
}

function ChecklistsPanel({
    checklists,
}: {
    checklists: ScreenSaverChecklist[] | null;
}) {
    return (
        <Card heading="Open checklists">
            {checklists === null ? null : checklists.length === 0 ? (
                <p className="text-white/70">Nothing left in progress.</p>
            ) : (
                <ul className="space-y-2">
                    {checklists.slice(0, 4).map((checklist) => (
                        <li
                            key={checklist.id}
                            className="space-y-1.5 rounded-lg bg-white/10 px-4 py-2.5"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {checklist.title}
                                    </p>
                                    {checklist.vehicle && (
                                        <p className="truncate text-sm text-white/60">
                                            {checklist.vehicle}
                                        </p>
                                    )}
                                </div>
                                <span className="shrink-0 text-sm text-white/60 tabular-nums">
                                    {checklist.checkedCount}/
                                    {checklist.itemsCount}
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                                <div
                                    className="bg-brand-orange h-full rounded-full"
                                    style={{
                                        width: `${checklist.itemsCount > 0 ? (checklist.checkedCount / checklist.itemsCount) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                    {checklists.length > 4 && (
                        <li className="text-sm text-white/60">
                            and {checklists.length - 4} more
                        </li>
                    )}
                </ul>
            )}
        </Card>
    );
}

function Clock({
    settings,
    centred,
}: {
    settings: ScreenSaverSettings;
    centred: boolean;
}) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const tick = window.setInterval(() => setNow(new Date()), 1000);

        return () => window.clearInterval(tick);
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
            className={cn(
                'flex flex-col gap-3 drop-shadow-lg',
                centred ? 'items-center text-center' : 'items-start',
            )}
        >
            <p className="flex items-baseline gap-3 font-light tabular-nums">
                <span className="text-[clamp(4rem,14vw,11rem)] leading-none tracking-tight">
                    {time}
                </span>
                {dayPeriod && (
                    <span className="text-brand-orange text-[clamp(1.25rem,4vw,3rem)] font-medium">
                        {dayPeriod}
                    </span>
                )}
            </p>

            {settings.showDate && (
                <p className="text-[clamp(1rem,3vw,1.75rem)] text-white/85">
                    {date}
                </p>
            )}
        </div>
    );
}
