import { router, useHttp } from '@inertiajs/react';
import { Loader2, RefreshCw, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import PhotoSpin from '@/components/photo-spin';
import { Button } from '@/components/ui/button';
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
import type { PhotoAngleOption, VehicleLook, VehiclePhotos } from '@/types';

/**
 * What the page says while the AI studies the photos, a line at a time.
 */
const STUDY_STEPS = [
    'Laying the photos out side by side…',
    'Reading the paint…',
    'Counting the wheel spokes…',
    'Looking for bull bars, racks and tow bars…',
    'Going over every panel for dents and scratches…',
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

/**
 * The vehicle's walk-around photos as a spin-around, with what an AI read
 * from them: paint, body, wheels, accessories, and any marks or damage.
 * Nothing shows until there are photos; the capture panel asks for them.
 */
export default function VehiclePhotosPanel({
    vehicleId,
    photos,
    photoAngles,
    look,
}: {
    vehicleId: string;
    photos: VehiclePhotos;
    photoAngles: PhotoAngleOption[];
    look: VehicleLook | null;
}) {
    const [fresh, setFresh] = useState<VehicleLook | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const study = useHttp<Record<string, never>, { look: VehicleLook }>({});

    const current = fresh ?? look;
    const photoCount = Object.values(photos).filter(Boolean).length;
    const outside = photoAngles.filter(
        (angle) => angle.value !== 'engine' && photos[angle.value],
    );
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

    if (photoCount === 0 && !current) {
        return null;
    }

    function readPhotos(): void {
        if (study.processing) {
            return;
        }

        setError(null);
        setStep(0);

        study
            .post(studyPhotos.url(vehicleId), {
                onError: (errors) => {
                    setError(
                        Object.values(errors)[0] ??
                            'Those photos could not be looked at.',
                    );
                },
                onHttpException: (response) => {
                    setError(
                        response.status === 429
                            ? 'That is a lot of reading in a minute. Give it a moment and try again.'
                            : (messageFrom(response.data) ??
                                  'The AI could not look at the photos just now. Try again in a minute.'),
                    );

                    return false;
                },
                onNetworkError: () => {
                    setError(
                        'Could not reach the server. Check the connection.',
                    );

                    return false;
                },
            })
            .then((response) => {
                if (response?.look) {
                    setFresh(response.look);
                }
            })
            .catch(() => {
                // Already shown through the handlers above.
            });
    }

    function forget(): void {
        router.delete(forgetLook.url(vehicleId), {
            preserveScroll: true,
            onSuccess: () => setFresh(null),
        });
    }

    return (
        <section className="bg-card overflow-hidden rounded-xl border">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                <div>
                    <h2 className="font-semibold">Photos</h2>
                    <p className="text-muted-foreground text-sm">
                        Your photos, stitched into a spin-around. Drag to turn
                        it.
                    </p>
                </div>

                {!current && outside.length > 0 && (
                    <Button
                        size="sm"
                        onClick={readPhotos}
                        disabled={study.processing}
                    >
                        {study.processing ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <Sparkles />
                        )}
                        {study.processing
                            ? STUDY_STEPS[step]
                            : 'Check the photos for damage'}
                    </Button>
                )}
            </header>

            {photoCount > 0 && (
                <div className="bg-muted/30 relative aspect-[16/10] min-h-72">
                    <PhotoSpin angles={photoAngles} photos={photos} />
                </div>
            )}

            {error && (
                <p className="text-destructive border-t px-6 py-3 text-sm">
                    {error}
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

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                variant={current.stale ? 'default' : 'outline'}
                                onClick={readPhotos}
                                disabled={
                                    study.processing || outside.length === 0
                                }
                            >
                                <RefreshCw
                                    className={cn(
                                        study.processing && 'animate-spin',
                                    )}
                                />
                                {study.processing
                                    ? STUDY_STEPS[step]
                                    : current.stale
                                      ? 'Photos changed, check again'
                                      : 'Check again'}
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
                                    <li
                                        key={index}
                                        className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
                                    >
                                        <span
                                            className={cn(
                                                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                                SEVERITY_CLASSES[mark.severity],
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
                                                · {DAMAGE_LABELS[mark.kind]},{' '}
                                                {mark.severity}
                                            </span>
                                            {mark.note && (
                                                <span className="text-muted-foreground block text-xs">
                                                    {mark.note}
                                                </span>
                                            )}
                                        </span>
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
