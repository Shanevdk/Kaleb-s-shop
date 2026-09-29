import { Link, router } from '@inertiajs/react';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatQuantity } from '@/lib/format';
import { replan } from '@/routes/inspection-items';
import { edit as editJob } from '@/routes/service-records';
import { index as shoppingList } from '@/routes/shopping-list';
import type { InspectionItem, RepairJob } from '@/types';

/**
 * What a flagged checklist item needs to put it right: the parts the
 * assistant worked out, and whether they are on the shelf or on the
 * shopping list.
 */
export default function RepairPartsNote({
    item,
    disabled = false,
}: {
    item: InspectionItem;
    disabled?: boolean;
}) {
    const checkAgain = () => {
        router.post(replan(item.id).url, {}, { preserveScroll: true });
    };

    const retryButton = (label: string) =>
        !disabled && (
            <button
                type="button"
                onClick={checkAgain}
                className="text-foreground inline-flex items-center gap-1 font-medium hover:underline"
            >
                <RefreshCw className="size-3" />
                {label}
            </button>
        );

    if (item.parts_status === 'pending') {
        return (
            <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                <Spinner className="size-3.5" />
                Working out the parts for this…
            </p>
        );
    }

    if (item.parts_status === 'failed') {
        return (
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                Couldn't work out the parts just now.
                {retryButton('Try again')}
            </p>
        );
    }

    if (item.parts_status === 'none_needed') {
        return (
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                No parts needed to put this right.
                {retryButton('Check again')}
            </p>
        );
    }

    if (item.parts_status === 'planned' && item.repair_job) {
        return <PlannedParts job={item.repair_job} />;
    }

    return null;
}

function PlannedParts({ job }: { job: RepairJob }) {
    const toBuy = job.parts.filter(
        (part) => !part.in_inventory || part.on_hand < part.quantity,
    );

    return (
        <div className="bg-muted/50 mt-2 space-y-2 rounded-md border border-dashed p-3 text-xs">
            <ul className="space-y-1">
                {job.parts.map((part) => {
                    const needsBuying =
                        !part.in_inventory || part.on_hand < part.quantity;

                    return (
                        <li
                            key={part.id}
                            className="flex items-baseline justify-between gap-3"
                        >
                            <span>
                                {part.name}{' '}
                                <span className="text-muted-foreground tabular-nums">
                                    ×{' '}
                                    {formatQuantity(
                                        part.quantity,
                                        part.unit_abbreviation,
                                    )}
                                </span>
                            </span>
                            <span
                                className={
                                    needsBuying
                                        ? 'shrink-0 font-medium text-amber-600 dark:text-amber-500'
                                        : 'text-muted-foreground shrink-0'
                                }
                            >
                                {!part.in_inventory
                                    ? 'Not stocked'
                                    : needsBuying
                                      ? 'Short'
                                      : 'On the shelf'}
                            </span>
                        </li>
                    );
                })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2">
                {toBuy.length > 0 && job.status !== 'completed' && (
                    <Link
                        href={shoppingList()}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                    >
                        <ShoppingCart className="size-3" />
                        {toBuy.length} on the shopping list
                    </Link>
                )}
                <Link
                    href={editJob(job.id)}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                >
                    Edit the repair job
                </Link>
            </div>
        </div>
    );
}
