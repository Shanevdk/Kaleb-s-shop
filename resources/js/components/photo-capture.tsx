import { router } from '@inertiajs/react';
import { Camera, Check, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { destroy, store } from '@/routes/vehicles/photos';
import type { PhotoAngle, PhotoAngleOption, VehiclePhotos } from '@/types';

/**
 * A guided walk-around: one tile per angle, each opening the camera on a
 * phone (or a file picker on a desktop) and uploading straight away.
 */
export default function PhotoCapture({
    vehicleId,
    angles,
    photos,
}: {
    vehicleId: string;
    angles: PhotoAngleOption[];
    photos: VehiclePhotos;
}) {
    const [busy, setBusy] = useState<PhotoAngle | null>(null);
    const [preview, setPreview] = useState<Partial<Record<PhotoAngle, string>>>(
        {},
    );
    const inputs = useRef<Partial<Record<PhotoAngle, HTMLInputElement | null>>>(
        {},
    );

    const ring = angles.filter((angle) => angle.degrees !== null);
    const extras = angles.filter((angle) => angle.degrees === null);
    const taken = angles.filter((angle) => photos[angle.value]).length;

    function upload(angle: PhotoAngle, file: File | null): void {
        if (!file) {
            return;
        }

        const url = URL.createObjectURL(file);
        setPreview((current) => ({ ...current, [angle]: url }));

        router.post(
            store.url({ vehicle: vehicleId, angle }),
            { photo: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setBusy(angle),
                onFinish: () => {
                    setBusy(null);
                    URL.revokeObjectURL(url);
                    setPreview((current) => {
                        const next = { ...current };
                        delete next[angle];

                        return next;
                    });
                },
            },
        );
    }

    function remove(angle: PhotoAngle): void {
        router.delete(destroy.url({ vehicle: vehicleId, angle }), {
            preserveScroll: true,
            onStart: () => setBusy(angle),
            onFinish: () => setBusy(null),
        });
    }

    const tile = (angle: PhotoAngleOption) => {
        const src = preview[angle.value] ?? photos[angle.value];
        const isBusy = busy === angle.value;

        return (
            <li key={angle.value} className="space-y-1.5">
                <button
                    type="button"
                    onClick={() => inputs.current[angle.value]?.click()}
                    disabled={isBusy}
                    className={cn(
                        'bg-muted/40 hover:bg-muted group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border transition-colors',
                        src && 'border-transparent',
                    )}
                    aria-label={
                        src
                            ? `Retake the ${angle.label.toLowerCase()} photo`
                            : `Take the ${angle.label.toLowerCase()} photo`
                    }
                >
                    {src ? (
                        <img
                            src={src}
                            alt={angle.label}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <Camera className="text-muted-foreground size-6" />
                    )}

                    {isBusy ? (
                        <span className="bg-background/70 absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-5 animate-spin" />
                        </span>
                    ) : src ? (
                        <span className="bg-background/80 absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                            <RefreshCw className="size-3" />
                            Retake
                        </span>
                    ) : null}

                    {src && !isBusy && (
                        <span className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Check className="size-3" />
                        </span>
                    )}
                </button>

                <input
                    ref={(element) => {
                        inputs.current[angle.value] = element;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                        upload(angle.value, event.target.files?.[0] ?? null);
                        event.target.value = '';
                    }}
                />

                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-medium">{angle.label}</p>
                        <p className="text-muted-foreground text-[11px] leading-snug">
                            {angle.hint}
                        </p>
                    </div>
                    {photos[angle.value] && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => remove(angle.value)}
                            disabled={isBusy}
                            aria-label={`Remove the ${angle.label.toLowerCase()} photo`}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    )}
                </div>
            </li>
        );
    };

    return (
        <section className="bg-card rounded-xl border">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                <div>
                    <h2 className="font-semibold">Photograph it</h2>
                    <p className="text-muted-foreground text-sm">
                        Walk round the machine and take a shot from each spot.
                        The photos become a spin-around view and get wrapped
                        onto the 3D model.
                    </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                    {taken} of {angles.length} taken
                </span>
            </header>

            <div className="space-y-6 p-6">
                <div className="space-y-3">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                        Walk-around
                    </h3>
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {ring.map(tile)}
                    </ul>
                </div>

                <div className="space-y-3">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                        Extra shots
                    </h3>
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {extras.map(tile)}
                    </ul>
                </div>

                <p className="text-muted-foreground text-xs">
                    Tip: keep the whole machine in frame, stand the same
                    distance away for every shot, and shoot in landscape.
                </p>
            </div>
        </section>
    );
}
