import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/empty-state';
import JobEstimate, { useEstimatePolling } from '@/components/job-estimate';
import PageHeader from '@/components/page-header';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index, update } from '@/routes/job-queue';
import { show as showJob } from '@/routes/service-records';
import type { ServiceRecord, ServiceRecordPart, ServiceStatus } from '@/types';

const columns: { status: ServiceStatus; title: string; icon: typeof Circle }[] = [
    { status: 'planned', title: 'Not started', icon: Circle },
    { status: 'in_progress', title: 'In progress', icon: ListTodo },
    { status: 'completed', title: 'Complete', icon: CheckCircle2 },
];

/**
 * Get the parts a job is still waiting on, the ones not yet fully taken off
 * the shelf.
 */
const outstandingParts = (job: ServiceRecord): ServiceRecordPart[] =>
    (job.parts ?? []).filter((part) => part.quantity_outstanding > 0);

/**
 * A job is only covered once the shelf can fill everything it is still
 * waiting on.
 */
const isFullyStocked = (job: ServiceRecord): boolean =>
    outstandingParts(job).every((part) => part.shortfall <= 0);

/**
 * Move a job to another column.
 */
const moveJob = (job: ServiceRecord, status: ServiceStatus) => {
    router.patch(
        update.url(job.id),
        { status },
        {
            preserveScroll: true,
            onError: (errors) =>
                toast.error(Object.values(errors)[0] ?? 'That could not be moved.'),
        },
    );
};

export default function JobQueue({ jobs }: { jobs: ServiceRecord[] }) {
    useEstimatePolling(
        jobs.map((job) => job.estimate),
        ['jobs'],
    );

    const byStatus = jobs.reduce<Record<ServiceStatus, ServiceRecord[]>>(
        (grouped, job) => {
            grouped[job.status] = [...grouped[job.status], job];

            return grouped;
        },
        { planned: [], in_progress: [], completed: [] },
    );

    const [dragging, setDragging] = useState<ServiceRecord | null>(null);
    const [dropTarget, setDropTarget] = useState<ServiceStatus | null>(null);

    const startDrag = (event: DragEvent, job: ServiceRecord) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', job.id);
        setDragging(job);
    };

    const endDrag = () => {
        setDragging(null);
        setDropTarget(null);
    };

    const dropOn = (event: DragEvent, status: ServiceStatus) => {
        event.preventDefault();
        const job = dragging;
        endDrag();

        if (job === null || job.status === status) {
            return;
        }

        moveJob(job, status);
    };

    const openJob = (job: ServiceRecord) => router.visit(showJob(job.id).url);

    const openOnKey = (event: KeyboardEvent, job: ServiceRecord) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openJob(job);
        }
    };

    return (
        <>
            <Head title="Job queue" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Job queue"
                    description="Drag a job between columns as it moves from not started, to in progress, to complete."
                />

                <div className="grid flex-1 gap-4 md:grid-cols-3">
                    {columns.map((column) => {
                        const columnJobs = byStatus[column.status];
                        const droppable =
                            dragging !== null && dragging.status !== column.status;

                        return (
                            <section
                                key={column.status}
                                onDragOver={(event) => {
                                    if (droppable) {
                                        event.preventDefault();
                                        setDropTarget(column.status);
                                    }
                                }}
                                onDragLeave={() =>
                                    setDropTarget((target) =>
                                        target === column.status ? null : target,
                                    )
                                }
                                onDrop={(event) => dropOn(event, column.status)}
                                className={cn(
                                    'bg-card flex flex-col rounded-xl border transition-colors',
                                    dropTarget === column.status &&
                                        'bg-sky-600/10 ring-2 ring-sky-600 ring-inset',
                                )}
                            >
                                <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <column.icon className="text-muted-foreground size-4" />
                                        {column.title}
                                    </div>
                                    <span className="text-muted-foreground text-xs tabular-nums">
                                        {columnJobs.length}
                                    </span>
                                </header>

                                <div className="flex flex-1 flex-col gap-2 p-3">
                                    {columnJobs.length === 0 ? (
                                        <EmptyState
                                            icon={column.icon}
                                            title="Nothing here"
                                            description="Drag a job into this column."
                                        />
                                    ) : (
                                        columnJobs.map((job) => (
                                            <div
                                                key={job.id}
                                                role="button"
                                                tabIndex={0}
                                                draggable
                                                onDragStart={(event) =>
                                                    startDrag(event, job)
                                                }
                                                onDragEnd={endDrag}
                                                onClick={() => openJob(job)}
                                                onKeyDown={(event) =>
                                                    openOnKey(event, job)
                                                }
                                                title="Tap to open, drag to move"
                                                className={cn(
                                                    'bg-background hover:bg-muted/50 focus-visible:ring-foreground cursor-pointer space-y-1.5 rounded-lg border p-3 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 active:cursor-grabbing',
                                                    dragging?.id === job.id &&
                                                        'opacity-30',
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="min-w-0 truncate font-medium">
                                                        {job.title}
                                                    </p>
                                                    <PartsStatus job={job} />
                                                </div>
                                                <p className="text-muted-foreground truncate text-xs">
                                                    {job.vehicle?.display_name ??
                                                        'No vehicle'}
                                                </p>
                                                <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                                                    <span className="truncate">
                                                        {job.type_label}
                                                    </span>
                                                    <span className="shrink-0">
                                                        {formatDate(
                                                            job.performed_on,
                                                        )}
                                                    </span>
                                                    {job.status !==
                                                        'completed' && (
                                                        <JobEstimate
                                                            estimate={
                                                                job.estimate
                                                            }
                                                            compact
                                                            className="ml-auto shrink-0 text-[11px]"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

JobQueue.layout = {
    breadcrumbs: [{ title: 'Job queue', href: index() }],
};

/**
 * A small red or green box showing whether the shelf can cover every part
 * the job still needs. Click it to see what is outstanding.
 */
function PartsStatus({ job }: { job: ServiceRecord }) {
    const outstanding = outstandingParts(job);
    const stocked = isFullyStocked(job);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    draggable={false}
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.stopPropagation()}
                    aria-label={
                        stocked
                            ? `${job.title}: all parts in stock`
                            : `${job.title}: missing parts, click for details`
                    }
                    title={
                        stocked
                            ? 'All parts in stock'
                            : 'Missing parts — click for details'
                    }
                    className={cn(
                        'mt-1 size-3 shrink-0 rounded-sm',
                        stocked ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{job.title}</DialogTitle>
                    <DialogDescription>
                        {outstanding.length === 0
                            ? 'Every part this job needs is in stock.'
                            : 'Parts still needed for this job.'}
                    </DialogDescription>
                </DialogHeader>

                {outstanding.length > 0 && (
                    <ul className="divide-y">
                        {outstanding.map((part) => (
                            <li
                                key={part.id}
                                className="flex items-center justify-between gap-3 py-2 text-sm"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {part.name}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {part.on_hand == null
                                            ? 'Not stocked'
                                            : `${formatNumber(part.on_hand)} ${part.unit_abbreviation} on hand`}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'shrink-0 text-xs font-medium tabular-nums',
                                        part.shortfall > 0
                                            ? 'text-red-600 dark:text-red-500'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {formatNumber(part.quantity_outstanding)}{' '}
                                    {part.unit_abbreviation} needed
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
