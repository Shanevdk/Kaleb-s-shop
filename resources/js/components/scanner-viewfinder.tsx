import { Flashlight, FlashlightOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BarcodeScanner } from '@/hooks/use-barcode-scanner';
import { cn } from '@/lib/utils';

/**
 * The live camera feed for a barcode scanner, with corners to aim inside,
 * a green outline round each code as it is read, and a torch button on
 * phones that have one. It fills its positioned parent.
 */
export default function ScannerViewfinder({
    scanner,
    className,
}: {
    scanner: BarcodeScanner;
    className?: string;
}) {
    const running = scanner.status === 'running';
    const { highlight } = scanner;

    return (
        <div className={cn('absolute inset-0 overflow-hidden', className)}>
            <video
                ref={scanner.videoRef}
                muted
                playsInline
                autoPlay
                className={cn(
                    'absolute inset-0 h-full w-full object-cover',
                    !running && 'invisible',
                )}
            />

            {running && (
                <>
                    <div
                        aria-hidden
                        className={cn(
                            'pointer-events-none absolute inset-x-[12%] inset-y-[22%] transition-colors duration-150',
                            highlight ? 'text-emerald-400' : 'text-white/90',
                        )}
                    >
                        <span className="absolute top-0 left-0 size-6 rounded-tl-lg border-t-4 border-l-4 border-current" />
                        <span className="absolute top-0 right-0 size-6 rounded-tr-lg border-t-4 border-r-4 border-current" />
                        <span className="absolute bottom-0 left-0 size-6 rounded-bl-lg border-b-4 border-l-4 border-current" />
                        <span className="absolute right-0 bottom-0 size-6 rounded-br-lg border-r-4 border-b-4 border-current" />
                    </div>

                    {highlight && (
                        // Same viewBox as the video and "slice" scaling, so
                        // the outline lines up with object-cover exactly.
                        <svg
                            aria-hidden
                            viewBox={`0 0 ${highlight.width} ${highlight.height}`}
                            preserveAspectRatio="xMidYMid slice"
                            className="pointer-events-none absolute inset-0 h-full w-full"
                        >
                            <polygon
                                points={highlight.points
                                    .map(({ x, y }) => `${x},${y}`)
                                    .join(' ')}
                                className="fill-emerald-400/25 stroke-emerald-400"
                                strokeWidth={Math.max(4, highlight.width / 200)}
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}

                    {scanner.torch.available && (
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={scanner.torch.toggle}
                            aria-pressed={scanner.torch.on}
                            aria-label={
                                scanner.torch.on
                                    ? 'Turn the torch off'
                                    : 'Turn the torch on'
                            }
                            className="absolute right-3 bottom-3 rounded-full opacity-90"
                        >
                            {scanner.torch.on ? (
                                <FlashlightOff />
                            ) : (
                                <Flashlight />
                            )}
                        </Button>
                    )}
                </>
            )}
        </div>
    );
}
