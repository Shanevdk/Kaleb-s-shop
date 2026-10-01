import { usePoll } from '@inertiajs/react';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { JobEstimate as Estimate } from '@/types';

/**
 * Keep reloading the given props while any of these estimates is still
 * being worked out, so the answer shows up without a refresh.
 */
export function useEstimatePolling(
    estimates: (Estimate | null | undefined)[],
    only: string[],
): void {
    const isEstimating = estimates.some(
        (estimate) => estimate?.status === 'pending',
    );
    const { start, stop } = usePoll(
        4000,
        { only },
        { autoStart: false, mode: 'rest' },
    );

    useEffect(() => {
        if (isEstimating) {
            start();
        } else {
            stop();
        }
    }, [isEstimating, start, stop]);
}

/**
 * The AI's estimate of how long a job will take. It is worked out in the
 * background whenever the job is saved with new notes; while a fresh one is
 * on its way, the last one stays up marked as updating.
 */
export default function JobEstimate({
    estimate,
    compact = false,
    className,
}: {
    estimate: Estimate | null | undefined;
    compact?: boolean;
    className?: string;
}) {
    if (!estimate) {
        return null;
    }

    const isPending = estimate.status === 'pending';
    const hasHours = estimate.hours !== null;
    const range =
        estimate.low !== null &&
        estimate.high !== null &&
        estimate.low !== estimate.high
            ? `${formatHours(estimate.low)}–${formatHours(estimate.high)}`
            : null;

    if (compact) {
        if (!hasHours && !isPending) {
            return null;
        }

        return (
            <span
                className={cn(
                    'text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums',
                    className,
                )}
                title={
                    estimate.reasoning ?? 'Estimated time for the whole job'
                }
            >
                {isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                ) : (
                    <Clock className="size-3" />
                )}
                {hasHours ? `~${formatHours(estimate.hours)}` : 'Estimating…'}
            </span>
        );
    }

    return (
        <div
            className={cn(
                'bg-muted/40 flex gap-3 rounded-lg border p-3 text-sm',
                className,
            )}
            aria-live="polite"
        >
            {estimate.status === 'failed' && !hasHours ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            ) : isPending ? (
                <Loader2 className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin" />
            ) : (
                <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            )}

            <div className="min-w-0 space-y-1">
                {hasHours ? (
                    <p>
                        <span className="font-medium">
                            Estimated time: about {formatHours(estimate.hours)}
                        </span>
                        {range && (
                            <span className="text-muted-foreground">
                                {' '}
                                ({range})
                            </span>
                        )}
                        {isPending && (
                            <span className="text-muted-foreground">
                                {' '}
                                · updating for the new notes…
                            </span>
                        )}
                    </p>
                ) : isPending ? (
                    <p className="text-muted-foreground">
                        Working out how long this job will take…
                    </p>
                ) : (
                    <p className="text-muted-foreground">
                        The AI could not estimate this job. It tries again
                        next time the notes change.
                    </p>
                )}

                {hasHours && estimate.reasoning && (
                    <p className="text-muted-foreground text-xs">
                        {estimate.reasoning}
                    </p>
                )}
            </div>
        </div>
    );
}
