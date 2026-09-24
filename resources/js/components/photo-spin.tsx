import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PhotoAngle, PhotoAngleOption, VehiclePhotos } from '@/types';

/**
 * A spin-around built from the walk-around photos: drag sideways or use the
 * arrows to turn the machine through whatever angles were shot. The top and
 * engine bay shots sit alongside as extra views.
 */
export default function PhotoSpin({
    angles,
    photos,
}: {
    angles: PhotoAngleOption[];
    photos: VehiclePhotos;
}) {
    const ring = angles
        .filter((angle) => angle.degrees !== null && photos[angle.value])
        .sort((a, b) => (a.degrees ?? 0) - (b.degrees ?? 0));
    const extras = angles.filter(
        (angle) => angle.degrees === null && photos[angle.value],
    );

    const [current, setCurrent] = useState<PhotoAngle>(
        ring[0]?.value ?? extras[0]?.value ?? 'front',
    );
    const drag = useRef<{ x: number; index: number } | null>(null);
    const stage = useRef<HTMLDivElement>(null);

    const index = Math.max(
        0,
        ring.findIndex((angle) => angle.value === current),
    );
    const inRing = ring.some((angle) => angle.value === current);

    function step(delta: number): void {
        if (ring.length === 0) {
            return;
        }

        const next =
            ((((inRing ? index : 0) + delta) % ring.length) + ring.length) %
            ring.length;
        setCurrent(ring[next].value);
    }

    // Keep the current shot valid if a photo is removed underneath us.
    useEffect(() => {
        if (!photos[current]) {
            setCurrent(ring[0]?.value ?? extras[0]?.value ?? 'front');
        }
    }, [photos, current, ring, extras]);

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
        drag.current = { x: event.clientX, index: inRing ? index : 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
        if (!drag.current || ring.length === 0) {
            return;
        }

        const width = stage.current?.clientWidth ?? 600;
        const perStep = width / Math.max(8, ring.length * 1.5);
        const moved = Math.round((event.clientX - drag.current.x) / perStep);
        const next =
            (((drag.current.index - moved) % ring.length) + ring.length) %
            ring.length;

        if (ring[next].value !== current) {
            setCurrent(ring[next].value);
        }
    }

    function onPointerUp(): void {
        drag.current = null;
    }

    const label = angles.find((angle) => angle.value === current)?.label ?? '';

    return (
        <div className="flex h-full flex-col">
            <div
                ref={stage}
                className="bg-muted/30 relative flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                {[...ring, ...extras].map((angle) => (
                    <img
                        key={angle.value}
                        src={photos[angle.value]}
                        alt={angle.label}
                        draggable={false}
                        className={cn(
                            'absolute inset-0 h-full w-full object-contain transition-opacity duration-150',
                            angle.value === current
                                ? 'opacity-100'
                                : 'opacity-0',
                        )}
                    />
                ))}

                {ring.length > 1 && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="bg-background/80 absolute top-1/2 left-3 -translate-y-1/2"
                            onClick={() => step(-1)}
                            aria-label="Turn left"
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="bg-background/80 absolute top-1/2 right-3 -translate-y-1/2"
                            onClick={() => step(1)}
                            aria-label="Turn right"
                        >
                            <ChevronRight />
                        </Button>
                    </>
                )}

                <span className="bg-background/90 pointer-events-none absolute bottom-3 left-3 rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
                    {label}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-3">
                {ring.map((angle) => (
                    <button
                        key={angle.value}
                        type="button"
                        onClick={() => setCurrent(angle.value)}
                        className={cn(
                            'hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors',
                            angle.value === current &&
                                'bg-primary text-primary-foreground hover:bg-primary border-transparent',
                        )}
                    >
                        {angle.degrees}°
                    </button>
                ))}
                {extras.length > 0 && ring.length > 0 && (
                    <span className="bg-border mx-1 h-4 w-px" />
                )}
                {extras.map((angle) => (
                    <button
                        key={angle.value}
                        type="button"
                        onClick={() => setCurrent(angle.value)}
                        className={cn(
                            'hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors',
                            angle.value === current &&
                                'bg-primary text-primary-foreground hover:bg-primary border-transparent',
                        )}
                    >
                        {angle.label}
                    </button>
                ))}
                <span className="text-muted-foreground ml-auto text-[11px]">
                    Drag to spin
                </span>
            </div>
        </div>
    );
}
