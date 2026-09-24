import { ArrowLeft, Box, Cog, Images, Orbit } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
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
import type {
    EngineSpecs,
    MachineKind,
    PhotoAngleOption,
    VehiclePhotos,
} from '@/types';

/**
 * three.js is a big download, so the viewer only arrives when a page
 * actually shows a model.
 */
const MachineViewer = lazy(() => import('@/components/machine-viewer'));

type Mode = 'model' | 'photos';

export default function MachineModel({
    kind,
    kindLabel,
    engine,
    engineSummary,
    doors = null,
    photos = {},
    photoAngles = [],
}: {
    kind: MachineKind;
    kindLabel: string;
    engine: Partial<EngineSpecs>;
    engineSummary?: string | null;
    doors?: number | null;
    photos?: VehiclePhotos;
    photoAngles?: PhotoAngleOption[];
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

    const hasEngine = kind !== 'trailer';
    const photoCount = Object.values(photos).filter(Boolean).length;
    const canWrap = ['front', 'rear', 'left', 'right', 'top'].some(
        (side) => photos[side as keyof VehiclePhotos],
    );
    const parts = ENGINE_PART_KEYS.filter((key) => available.includes(key));
    const detail = selected ? ENGINE_PARTS[selected] : null;
    const showingPhotos = mode === 'photos' && photoCount > 0;

    function showMachine(): void {
        setView('machine');
        setSelected(null);
    }

    const description = showingPhotos
        ? 'Your photos, stitched into a spin-around. Drag to turn it.'
        : view === 'machine'
          ? hasEngine
              ? 'Drag to spin it round. Click the glowing marker to open the engine bay.'
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
                    {photoCount > 0 && (
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

                    {!showingPhotos && canWrap && view === 'machine' && (
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
                    ) : (
                        <>
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
                                    photos={photos}
                                    wrapPhotos={wrap && canWrap}
                                    view={view}
                                    selectedPart={selected}
                                    appearance={resolvedAppearance}
                                    onViewChange={setView}
                                    onHoverPart={setHovered}
                                    onSelectPart={setSelected}
                                    onPartsReady={setAvailable}
                                />
                            </Suspense>

                            <span className="bg-background/80 text-muted-foreground pointer-events-none absolute top-3 right-3 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                                {kindLabel}
                            </span>

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
        </section>
    );
}
