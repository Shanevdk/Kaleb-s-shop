import { router } from '@inertiajs/react';
import {
    Camera,
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    Loader2,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import EmptyState from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { showFailure } from '@/lib/optimistic';
import { destroy, store } from '@/routes/equipment/photos';
import type { Equipment, EquipmentPhoto } from '@/types';

/**
 * The equipment's photos as a grid. Several can be added at once (a phone
 * offers the camera or the gallery), each opens full size, and one can be
 * removed from there. Photos still uploading show straight away from the
 * device, and one removed goes at once, coming back if the server says no.
 */
export default function EquipmentPhotos({
    equipmentId,
    name,
    photos,
}: {
    equipmentId: string;
    name: string;
    photos: EquipmentPhoto[];
}) {
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<string[]>([]);
    const [viewing, setViewing] = useState<number | null>(null);

    const current = viewing === null ? null : (photos[viewing] ?? null);

    function upload(files: File[]): void {
        if (files.length === 0) {
            return;
        }

        const previews = files.map((file) => URL.createObjectURL(file));
        setUploading((existing) => [...existing, ...previews]);

        router.post(
            store.url(equipmentId),
            { photos: files },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (errors) =>
                    showFailure(errors, 'Those photos could not be added.'),
                onFinish: () => {
                    previews.forEach((preview) => URL.revokeObjectURL(preview));
                    setUploading((existing) =>
                        existing.filter(
                            (preview) => !previews.includes(preview),
                        ),
                    );
                },
            },
        );
    }

    function remove(photo: EquipmentPhoto): void {
        setViewing(null);

        router
            .optimistic<{ equipment: Equipment }>((props) => ({
                equipment: {
                    ...props.equipment,
                    photos: props.equipment.photos.filter(
                        (existing) => existing.id !== photo.id,
                    ),
                },
            }))
            .delete(destroy.url({ equipment: equipmentId, photo: photo.id }), {
                preserveScroll: true,
                showProgress: false,
                onError: (errors) =>
                    showFailure(errors, 'That photo could not be removed.'),
            });
    }

    function step(by: number): void {
        setViewing((index) =>
            index === null
                ? null
                : (index + by + photos.length) % photos.length,
        );
    }

    function stepOnKey(event: KeyboardEvent): void {
        if (event.key === 'ArrowLeft') {
            step(-1);
        } else if (event.key === 'ArrowRight') {
            step(1);
        }
    }

    const addButton = (
        <Button
            size="sm"
            variant="outline"
            onClick={() => input.current?.click()}
        >
            <ImagePlus />
            Add photos
        </Button>
    );

    return (
        <section className="bg-card rounded-xl border">
            <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
                <div>
                    <h2 className="font-semibold">Photos</h2>
                    <p className="text-muted-foreground text-sm tabular-nums">
                        {photos.length === 0
                            ? 'None yet'
                            : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
                    </p>
                </div>
                {(photos.length > 0 || uploading.length > 0) && addButton}
            </header>

            <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    upload(Array.from(event.target.files ?? []));
                    event.target.value = '';
                }}
            />

            {photos.length === 0 && uploading.length === 0 ? (
                <div className="p-6">
                    <EmptyState
                        icon={Camera}
                        title="No photos yet"
                        description="Snap the machine, its data plate or anything worth remembering about it. Pick several at once."
                        action={addButton}
                    />
                </div>
            ) : (
                <ul className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 xl:grid-cols-6">
                    {photos.map((photo, index) => (
                        <li key={photo.id}>
                            <button
                                type="button"
                                onClick={() => setViewing(index)}
                                className="bg-muted/40 focus-visible:ring-ring block aspect-square w-full overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
                                aria-label={`Open photo ${index + 1} of ${name}`}
                            >
                                <img
                                    src={photo.url}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover transition-transform hover:scale-105"
                                />
                            </button>
                        </li>
                    ))}
                    {uploading.map((preview) => (
                        <li
                            key={preview}
                            className="relative aspect-square overflow-hidden rounded-lg border"
                        >
                            <img
                                src={preview}
                                alt=""
                                className="h-full w-full object-cover opacity-60"
                            />
                            <span className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="size-5 animate-spin" />
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog
                open={current !== null}
                onOpenChange={(open) => !open && setViewing(null)}
            >
                <DialogContent className="sm:max-w-4xl" onKeyDown={stepOnKey}>
                    <DialogTitle>{name}</DialogTitle>
                    <DialogDescription className="tabular-nums">
                        Photo {(viewing ?? 0) + 1} of {photos.length}
                    </DialogDescription>

                    {current && (
                        <img
                            src={current.url}
                            alt={`${name}, photo ${(viewing ?? 0) + 1}`}
                            className="bg-muted/40 max-h-[70vh] w-full rounded-lg object-contain"
                        />
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => step(-1)}
                                disabled={photos.length < 2}
                                aria-label="Previous photo"
                            >
                                <ChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => step(1)}
                                disabled={photos.length < 2}
                                aria-label="Next photo"
                            >
                                <ChevronRight />
                            </Button>
                        </div>
                        {current && (
                            <Button
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => remove(current)}
                            >
                                <Trash2 />
                                Remove photo
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
