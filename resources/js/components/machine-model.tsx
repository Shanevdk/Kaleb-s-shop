import { router, useHttp } from '@inertiajs/react';
import {
    ArrowLeft,
    Box,
    BoxSelect,
    Cog,
    Images,
    Orbit,
    RefreshCw,
    Sparkles,
    Undo2,
} from 'lucide-react';
import {
    Component,
    lazy,
    Suspense,
    useEffect,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from 'react';
import type { ViewerView } from '@/components/machine-viewer';
import PhotoSpin from '@/components/photo-spin';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppearance } from '@/hooks/use-appearance';
import {
    ENGINE_PART_KEYS,
    ENGINE_PARTS,
    type EnginePartKey,
} from '@/lib/engine-parts';
import { cn } from '@/lib/utils';
import {
    ACCESSORY_LABELS,
    AREA_LABELS,
    BODY_LABELS,
    DAMAGE_LABELS,
    SEVERITY_CLASSES,
    describeConfidence,
    describeWheels,
} from '@/lib/vehicle-look';
import {
    destroy as forgetLook,
    store as studyPhotos,
} from '@/routes/vehicles/look';
import type {
    EngineSpecs,
    MachineKind,
    PhotoAngleOption,
    VehicleLook,
    VehiclePhotos,
} from '@/types';

/**
 * three.js is a big download, so the viewer only arrives when a page
 * actually shows a model.
 */
const MachineViewer = lazy(() => import('@/components/machine-viewer'));

type Mode = 'model' | 'photos';

/**
 * What the page says while the AI studies the photos, a line at a time.
 */
const STUDY_STEPS = [
    'Laying the photos out side by side…',
    'Reading the paint…',
    'Counting the wheel spokes…',
    'Looking for bull bars, racks and tow bars…',
    'Going over every panel for dents and scratches…',
    'Matching the model to what it sees…',
];

/**
 * Pull the message out of a JSON error response.
 */
function messageFrom(data: unknown): string | null {
    try {
        const body = typeof data === 'string' ? JSON.parse(data) : data;

        return typeof body?.message === 'string' ? body.message : null;
    } catch {
        return null;
    }
}

/**
 * A small pill for one thing the AI saw.
 */
function Seen({ children }: { children: ReactNode }) {
    return (
        <li className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            {children}
        </li>
    );
}

let webglSupport: boolean | undefined;

/**
 * Determine whether the browser can draw 3D at all. Some have WebGL switched
 * off (hardware acceleration disabled, or a blocklisted graphics driver), and
 * three.js throws when it cannot get a context. The probe context is released
 * straight away so it does not count against the browser's limit.
 */
function supportsWebGL(): boolean {
    if (webglSupport === undefined) {
        try {
            const canvas = document.createElement('canvas');
            const context =
                canvas.getContext('webgl2') ?? canvas.getContext('webgl');

            webglSupport = context !== null;
            context?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
            webglSupport = false;
        }
    }

    return webglSupport;
}

function neverChanges(): () => void {
    return () => {};
}

/**
 * Keep a failing 3D viewer to its own box rather than taking the whole page
 * down with it.
 */
class ViewerBoundary extends Component<
    { fallback: ReactNode; children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    render(): ReactNode {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function NoModel({ hasPhotos }: { hasPhotos: boolean }) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <BoxSelect className="text-muted-foreground size-8" />
            <p className="text-sm font-medium">
                The 3D model cannot be shown in this browser
            </p>
            <p className="text-muted-foreground max-w-sm text-xs">
                3D graphics (WebGL) are turned off. Switching on hardware
                acceleration in the browser settings usually brings it back.
                {hasPhotos && ' The photos still work.'}
            </p>
        </div>
    );
}

export default function MachineModel({
    kind,
    kindLabel,
    engine,
    engineSummary,
    doors = null,
    bodyClass = null,
    driveType = null,
    colour = null,
    registration = null,
    photos = {},
    photoAngles = [],
    vehicleId = null,
    look = null,
}: {
    kind: MachineKind;
    kindLabel: string;
    engine: Partial<EngineSpecs>;
    engineSummary?: string | null;
    doors?: number | null;
    bodyClass?: string | null;
    driveType?: string | null;
    colour?: string | null;
    registration?: string | null;
    photos?: VehiclePhotos;
    photoAngles?: PhotoAngleOption[];
    /** The shop's vehicle, when the model can be matched to its photos. */
    vehicleId?: string | null;
    /** What an AI already read from the photos. */
    look?: VehicleLook | null;
}) {
    const [mode, setMode] = useState<Mode>('model');
    const [view, setView] = useState<ViewerView>('machine');
    const [wrap, setWrap] = useState(true);
    const [hovered, setHovered] = useState<EnginePartKey | 'engine' | null>(
        null,
    );
    const [selected, setSelected] = useState<EnginePartKey | null>(null);
    const [available, setAvailable] = useState<EnginePartKey[]>([]);
    const { resolvedAppearance } = useAppearance();
    // Assumed possible while rendering on the server, then checked for real.
    const canDraw3d = useSyncExternalStore(
        neverChanges,
        supportsWebGL,
        () => true,
    );

    const hasEngine = kind !== 'trailer';
    const photoCount = Object.values(photos).filter(Boolean).length;
    const canWrap = ['front', 'rear', 'left', 'right', 'top'].some(
        (side) => photos[side as keyof VehiclePhotos],
    );
    const parts = ENGINE_PART_KEYS.filter((key) => available.includes(key));
    const detail = selected ? ENGINE_PARTS[selected] : null;
    const showingPhotos = (mode === 'photos' || !canDraw3d) && photoCount > 0;

    // Matching the model to the photos with a model that can see them.
    const [fresh, setFresh] = useState<VehicleLook | null>(null);
    const [matched, setMatched] = useState(true);
    const [matchError, setMatchError] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [selectedDamage, setSelectedDamage] = useState<number | null>(null);
    const [focus, setFocus] = useState<{
        index: number;
        nonce: number;
    } | null>(null);
    const study = useHttp<Record<string, never>, { look: VehicleLook }>({});
    const current = fresh ?? look;
    const outside = photoAngles.filter(
        (angle) => angle.value !== 'engine' && photos[angle.value],
    );
    const canMatch = vehicleId !== null && canDraw3d && outside.length > 0;
    const shown = matched ? current : null;
    const damage = shown?.damage ?? [];
    const wheels = describeWheels(current?.wheels ?? null);

    useEffect(() => {
        if (!study.processing) {
            return;
        }

        const timer = window.setInterval(
            () => setStep((previous) => (previous + 1) % STUDY_STEPS.length),
            1800,
        );

        return () => window.clearInterval(timer);
    }, [study.processing]);

    function matchToPhotos(): void {
        if (vehicleId === null || study.processing) {
            return;
        }

        setMatchError(null);
        setStep(0);
        setMode('model');
        setView('machine');

        study
            .post(studyPhotos.url(vehicleId), {
                onError: (errors) => {
                    setMatchError(
                        Object.values(errors)[0] ??
                            'Those photos could not be looked at.',
                    );
                },
                onHttpException: (response) => {
                    setMatchError(
                        response.status === 429
                            ? 'That is a lot of matching in a minute. Give it a moment and try again.'
                            : (messageFrom(response.data) ??
                                  'The AI could not look at the photos just now. Try again in a minute.'),
                    );

                    return false;
                },
                onNetworkError: () => {
                    setMatchError(
                        'Could not reach the server. Check the connection.',
                    );

                    return false;
                },
            })
            .then((response) => {
                if (response?.look) {
                    setFresh(response.look);
                    setMatched(true);
                    setSelectedDamage(null);
                }
            })
            .catch(() => {
                // Already shown through the handlers above.
            });
    }

    function forget(): void {
        if (vehicleId === null) {
            return;
        }

        router.delete(forgetLook.url(vehicleId), {
            preserveScroll: true,
            onSuccess: () => {
                setFresh(null);
                setSelectedDamage(null);
            },
        });
    }

    function pickDamage(index: number): void {
        setMode('model');
        setView('machine');
        setSelectedDamage(index);
        setFocus((previous) => ({
            index,
            nonce: (previous?.nonce ?? 0) + 1,
        }));
    }

    function showMachine(): void {
        setView('machine');
        setSelected(null);
    }

    const description = showingPhotos
        ? 'Your photos, stitched into a spin-around. Drag to turn it.'
        : !canDraw3d
          ? (engineSummary ?? 'A 3D model needs 3D graphics in the browser.')
          : view === 'machine'
            ? hasEngine
                ? 'Drag to spin it round. Click the glowing marker over the engine to look inside.'
                : 'Drag to spin it round. A trailer has no engine to look at.'
            : (engineSummary ?? 'Click a part of the engine to read about it.');

    return (
        <section className="bg-card overflow-hidden rounded-xl border">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                <div>
                    <h2 className="font-semibold">
                        {showingPhotos
                            ? 'Spin-around'
                            : view === 'machine'
                              ? '3D model'
                              : 'Engine bay'}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {photoCount > 0 && canDraw3d && (
                        <div className="bg-muted inline-flex rounded-md p-0.5">
                            <button
                                type="button"
                                onClick={() => setMode('model')}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                    mode === 'model'
                                        ? 'bg-background shadow-sm'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <Box className="size-3.5" />
                                Model
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('photos')}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                    mode === 'photos'
                                        ? 'bg-background shadow-sm'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <Images className="size-3.5" />
                                Photos
                            </button>
                        </div>
                    )}

                    {!showingPhotos &&
                        canMatch &&
                        view === 'machine' &&
                        (current ? (
                            <Button
                                size="sm"
                                variant={matched ? 'default' : 'outline'}
                                onClick={() =>
                                    setMatched((previous) => !previous)
                                }
                                aria-pressed={matched}
                            >
                                <Sparkles />
                                {matched
                                    ? 'Matched to photos'
                                    : 'Match to photos'}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={matchToPhotos}
                                disabled={study.processing}
                            >
                                <Sparkles />
                                {study.processing
                                    ? 'Studying the photos…'
                                    : 'Match to photos'}
                            </Button>
                        ))}

                    {!showingPhotos &&
                        canDraw3d &&
                        canWrap &&
                        view === 'machine' && (
                            <Button
                                size="sm"
                                variant={wrap ? 'default' : 'outline'}
                                onClick={() => setWrap((current) => !current)}
                                aria-pressed={wrap}
                            >
                                <Images />
                                {wrap ? 'Photos wrapped on' : 'Wrap photos on'}
                            </Button>
                        )}

                    {!showingPhotos &&
                        canDraw3d &&
                        hasEngine &&
                        (view === 'machine' ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setView('engine')}
                            >
                                <Cog />
                                Look at the engine
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={showMachine}
                            >
                                <ArrowLeft />
                                Back to the machine
                            </Button>
                        ))}
                </div>
            </header>

            <div
                className={cn(
                    'grid',
                    !showingPhotos &&
                        view === 'engine' &&
                        'lg:grid-cols-[1fr_300px]',
                )}
            >
                <div className="bg-muted/30 relative aspect-[16/10] min-h-72">
                    {showingPhotos ? (
                        <PhotoSpin angles={photoAngles} photos={photos} />
                    ) : !canDraw3d ? (
                        <NoModel hasPhotos={photoCount > 0} />
                    ) : (
                        <>
                            <ViewerBoundary
                                fallback={
                                    <NoModel hasPhotos={photoCount > 0} />
                                }
                            >
                                <Suspense
                                    fallback={
                                        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                                            <Skeleton className="size-24 rounded-full" />
                                            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                                                <Orbit className="size-3.5 animate-spin" />
                                                Building the model
                                            </p>
                                        </div>
                                    }
                                >
                                    <MachineViewer
                                        kind={kind}
                                        engine={engine}
                                        doors={doors}
                                        bodyClass={bodyClass}
                                        driveType={driveType}
                                        colour={colour}
                                        registration={registration}
                                        photos={photos}
                                        wrapPhotos={wrap && canWrap}
                                        view={view}
                                        selectedPart={selected}
                                        appearance={resolvedAppearance}
                                        look={shown}
                                        damage={damage}
                                        selectedDamage={selectedDamage}
                                        focus={focus}
                                        onSelectDamage={pickDamage}
                                        onViewChange={setView}
                                        onHoverPart={setHovered}
                                        onSelectPart={setSelected}
                                        onPartsReady={setAvailable}
                                    />
                                </Suspense>
                            </ViewerBoundary>

                            <span className="bg-background/80 text-muted-foreground pointer-events-none absolute top-3 right-3 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                                {kindLabel}
                            </span>

                            {study.processing && (
                                <div
                                    className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
                                    aria-live="polite"
                                >
                                    <div className="bg-background/30 absolute inset-0" />
                                    <div className="animate-scan absolute inset-x-0 h-28 -translate-y-1/2 bg-linear-to-b from-transparent via-sky-400/20 to-transparent">
                                        <div className="absolute inset-x-0 top-1/2 h-px bg-sky-400 shadow-[0_0_14px_3px_rgba(56,189,248,0.65)]" />
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4">
                                        <div className="flex gap-1.5">
                                            {outside
                                                .slice(0, 6)
                                                .map((angle, index) => (
                                                    <img
                                                        key={angle.value}
                                                        src={
                                                            photos[angle.value]
                                                        }
                                                        alt={angle.label}
                                                        className="size-12 animate-pulse rounded-md border-2 border-white/80 object-cover shadow-md"
                                                        style={{
                                                            animationDelay: `${index * 180}ms`,
                                                        }}
                                                    />
                                                ))}
                                        </div>
                                        <p className="bg-background/90 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
                                            <Sparkles className="size-3.5 text-sky-500" />
                                            {STUDY_STEPS[step]}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {hovered && (
                                <span className="bg-background/90 pointer-events-none absolute bottom-3 left-3 rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
                                    {hovered === 'engine'
                                        ? 'Engine bay · click to open'
                                        : ENGINE_PARTS[hovered].label}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {!showingPhotos && view === 'engine' && (
                    <aside className="space-y-4 border-t p-4 lg:border-t-0 lg:border-l">
                        {photos.engine && (
                            <img
                                src={photos.engine}
                                alt="Engine bay photo"
                                className="aspect-[4/3] w-full rounded-lg border object-cover"
                            />
                        )}

                        {detail ? (
                            <div className="space-y-2">
                                <p className="font-semibold">{detail.label}</p>
                                <p className="text-sm">{detail.does}</p>
                                <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                    Watch for
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {detail.watch}
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                Click a part of the engine, or pick one from the
                                list.
                            </p>
                        )}

                        <ul className="flex flex-wrap gap-1.5">
                            {parts.map((key) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(key)}
                                        className={cn(
                                            'hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors',
                                            selected === key &&
                                                'bg-primary text-primary-foreground hover:bg-primary border-transparent',
                                        )}
                                    >
                                        {ENGINE_PARTS[key].label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </aside>
                )}
            </div>

            {matchError && (
                <p className="text-destructive border-t px-6 py-3 text-sm">
                    {matchError}
                </p>
            )}

            {current && (
                <div className="space-y-4 border-t px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                                <Sparkles className="size-4 text-sky-500" />
                                What the AI saw in the photos
                            </p>
                            {current.summary && (
                                <p className="text-muted-foreground max-w-prose text-sm">
                                    {current.summary}
                                </p>
                            )}
                        </div>

                        {vehicleId !== null && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant={
                                        current.stale ? 'default' : 'outline'
                                    }
                                    onClick={matchToPhotos}
                                    disabled={study.processing || !canMatch}
                                >
                                    <RefreshCw
                                        className={cn(
                                            study.processing && 'animate-spin',
                                        )}
                                    />
                                    {current.stale
                                        ? 'Photos changed, match again'
                                        : 'Match again'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={forget}
                                    disabled={study.processing}
                                >
                                    <Undo2 />
                                    Forget
                                </Button>
                            </div>
                        )}
                    </div>

                    <ul className="flex flex-wrap gap-1.5 text-xs">
                        {current.colour && (
                            <Seen>
                                <span
                                    className="size-3 rounded-full border"
                                    style={{
                                        backgroundColor:
                                            current.colour.hex ?? undefined,
                                    }}
                                />
                                <span className="capitalize">
                                    {current.colour.name}
                                </span>
                                {current.colour.finish !== 'solid' &&
                                    ` · ${current.colour.finish}`}
                            </Seen>
                        )}
                        {current.body_style && (
                            <Seen>
                                {BODY_LABELS[current.body_style]}
                                {current.roof === 'high' && ' · high roof'}
                                {current.cab && ` · ${current.cab} cab`}
                            </Seen>
                        )}
                        {wheels && <Seen>{wheels}</Seen>}
                        {current.tinted_windows && <Seen>Tinted windows</Seen>}
                        {current.accessories.map((accessory) => (
                            <Seen key={accessory}>
                                {ACCESSORY_LABELS[accessory]}
                            </Seen>
                        ))}
                    </ul>

                    {current.damage.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                Marks and damage
                            </p>
                            <ol className="grid gap-1.5 sm:grid-cols-2">
                                {current.damage.map((mark, index) => (
                                    <li key={index}>
                                        <button
                                            type="button"
                                            onClick={() => pickDamage(index)}
                                            className={cn(
                                                'hover:bg-accent flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                                                selectedDamage === index &&
                                                    'border-primary bg-accent',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                                    SEVERITY_CLASSES[
                                                        mark.severity
                                                    ],
                                                )}
                                            >
                                                {index + 1}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="font-medium">
                                                    {AREA_LABELS[mark.area]}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    · {DAMAGE_LABELS[mark.kind]}
                                                    , {mark.severity}
                                                </span>
                                                {mark.note && (
                                                    <span className="text-muted-foreground block text-xs">
                                                        {mark.note}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No marks or damage spotted in the photos.
                        </p>
                    )}

                    <p className="text-muted-foreground text-xs">
                        {[
                            describeConfidence(current.confidence),
                            `Read from ${current.angles.length} ${current.angles.length === 1 ? 'photo' : 'photos'}`,
                            current.model ? `by ${current.model}` : null,
                            new Date(current.studied_at).toLocaleDateString(
                                'en-US',
                                {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                },
                            ),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                        . The AI can be wrong, so check anything that matters.
                    </p>
                </div>
            )}
        </section>
    );
}
