import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import {
    screenSaverPreviewEvent,
    useScreenSaver,
} from '@/hooks/use-screen-saver';
import type { ScreenSaverSettings } from '@/hooks/use-screen-saver';
import { useScreenSaverData } from '@/hooks/use-screen-saver-data';
import type {
    ScreenSaverChecklist,
    ScreenSaverData,
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

type Slide = { type: 'clock' } | { type: 'schedule' } | { type: 'checklists' };

/**
 * A clock (and, if set up, today's jobs and open checklists) that drops
 * down over the app after a while with nobody using it, with any photos
 * added kept in a panel of their own alongside whichever of those is
 * showing. It only goes back up when it is deliberately tapped, clicked or
 * a key is pressed - not from a scroll, a drag or the mouse drifting.
 */
export default function ScreenSaver() {
    const settings = useScreenSaver();
    const { name } = usePage().props;
    const [active, setActive] = useState(false);
    const activeRef = useRef(false);
    const timer = useRef<number | undefined>(undefined);

    const pictures = useScreenSaverImageUrls();
    const showPictures =
        settings.panels.includes('pictures') && pictures.length > 0;
    const needsData =
        settings.panels.includes('schedule') ||
        settings.panels.includes('checklists');
    const data = useScreenSaverData(active && needsData);

    const mainPanels = useMemo(
        () => settings.panels.filter((panel) => panel !== 'pictures'),
        [settings.panels],
    );

    const slides = useMemo<Slide[]>(() => {
        const built = mainPanels.map((panel): Slide => ({
            type: panel as Slide['type'],
        }));

        // Something always has to be on screen.
        return built.length > 0 ? built : [{ type: 'clock' }];
    }, [mainPanels]);

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

    // Step through the slides while it is down.
    const [slideIndex, setSlideIndex] = useState(0);

    useEffect(() => {
        if (!active) {
            setSlideIndex(0);

            return;
        }

        if (slides.length <= 1) {
            return;
        }

        const step = window.setInterval(() => {
            setSlideIndex((index) => (index + 1) % slides.length);
        }, settings.secondsPerPanel * 1000);

        return () => window.clearInterval(step);
    }, [active, slides.length, settings.secondsPerPanel]);

    const slide = slides[slideIndex % slides.length];

    // Step through the photos, independently of the main slide, while a
    // picture panel is showing.
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
                'bg-brand-navy fixed inset-0 z-[100] flex cursor-pointer overflow-hidden text-white shadow-2xl transition-transform duration-700 ease-out select-none motion-reduce:transition-none',
                active
                    ? 'translate-y-0'
                    : 'pointer-events-none -translate-y-full',
            )}
        >
            {active && (
                <div className="flex h-full w-full flex-col md:flex-row">
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-10">
                        <SlideView
                            slide={slide}
                            settings={settings}
                            shopName={name}
                            data={data}
                        />
                    </div>

                    {showPictures && (
                        <PicturePanel
                            url={pictures[pictureIndex % pictures.length].url}
                        />
                    )}
                </div>
            )}

            <div className="bg-brand-orange absolute inset-x-0 bottom-0 h-1.5" />
            <p className="absolute inset-x-0 bottom-8 text-center text-xs tracking-[0.3em] text-white/50 uppercase">
                Tap anywhere to carry on
            </p>
        </div>
    );
}

function SlideView({
    slide,
    settings,
    shopName,
    data,
}: {
    slide: Slide;
    settings: ScreenSaverSettings;
    shopName: string;
    data: ScreenSaverData | null;
}) {
    if (slide.type === 'schedule') {
        return (
            <SchedulePanel jobs={data?.jobsToday ?? null} shopName={shopName} />
        );
    }

    if (slide.type === 'checklists') {
        return (
            <ChecklistsPanel
                checklists={data?.checklistsInProgress ?? null}
                shopName={shopName}
            />
        );
    }

    return <Clock settings={settings} shopName={shopName} />;
}

/**
 * A fixed strip of the screen, separate from whichever main slide is
 * showing, that keeps cycling through the photos on its own.
 */
function PicturePanel({ url }: { url: string }) {
    return (
        <div className="relative h-56 w-full shrink-0 overflow-hidden border-t border-white/10 md:h-full md:w-2/5 md:max-w-md md:border-t-0 md:border-l">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:bg-gradient-to-l" />
        </div>
    );
}

function PanelHeading({ children }: { children: string }) {
    return (
        <p className="text-brand-orange text-sm font-medium tracking-[0.3em] uppercase">
            {children}
        </p>
    );
}

function SchedulePanel({
    jobs,
    shopName,
}: {
    jobs: ScreenSaverJob[] | null;
    shopName: string;
}) {
    return (
        <div className="flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
            <PanelHeading>Today&rsquo;s jobs</PanelHeading>

            {jobs === null ? null : jobs.length === 0 ? (
                <p className="text-lg text-white/70">
                    Nothing booked in for today.
                </p>
            ) : (
                <ul className="w-full space-y-2.5 text-left">
                    {jobs.slice(0, 6).map((job) => (
                        <li
                            key={job.id}
                            className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    {job.title}
                                </p>
                                {job.vehicle && (
                                    <p className="truncate text-sm text-white/50">
                                        {job.vehicle}
                                    </p>
                                )}
                            </div>
                            <span className="text-brand-orange shrink-0 text-xs tracking-wide uppercase">
                                {job.status.replace('_', ' ')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-sm tracking-[0.3em] text-white/40 uppercase">
                {shopName}
            </p>
        </div>
    );
}

function ChecklistsPanel({
    checklists,
    shopName,
}: {
    checklists: ScreenSaverChecklist[] | null;
    shopName: string;
}) {
    return (
        <div className="flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
            <PanelHeading>Open checklists</PanelHeading>

            {checklists === null ? null : checklists.length === 0 ? (
                <p className="text-lg text-white/70">
                    Nothing left in progress.
                </p>
            ) : (
                <ul className="w-full space-y-2.5 text-left">
                    {checklists.slice(0, 6).map((checklist) => (
                        <li
                            key={checklist.id}
                            className="space-y-1.5 rounded-lg bg-white/5 px-4 py-3"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {checklist.title}
                                    </p>
                                    {checklist.vehicle && (
                                        <p className="truncate text-sm text-white/50">
                                            {checklist.vehicle}
                                        </p>
                                    )}
                                </div>
                                <span className="shrink-0 text-sm text-white/50 tabular-nums">
                                    {checklist.checkedCount}/
                                    {checklist.itemsCount}
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="bg-brand-orange h-full rounded-full"
                                    style={{
                                        width: `${checklist.itemsCount > 0 ? (checklist.checkedCount / checklist.itemsCount) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-sm tracking-[0.3em] text-white/40 uppercase">
                {shopName}
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
