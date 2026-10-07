import { Skeleton } from '@/components/ui/skeleton';

/**
 * Stands in for a page while it loads: a header, a row of stats and a list,
 * the shape most pages take.
 */
export default function PageSkeleton() {
    return (
        <div
            className="flex flex-1 flex-col gap-6 p-4 sm:p-6"
            role="status"
            aria-label="Loading"
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <Skeleton className="h-9 w-32" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div
                        key={index}
                        className="space-y-3 rounded-xl border p-5"
                    >
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border">
                {Array.from({ length: 6 }, (_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0"
                    >
                        <Skeleton className="size-10 shrink-0 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-2/5" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="hidden h-8 w-20 sm:block" />
                    </div>
                ))}
            </div>
            <span className="sr-only">Loading…</span>
        </div>
    );
}
