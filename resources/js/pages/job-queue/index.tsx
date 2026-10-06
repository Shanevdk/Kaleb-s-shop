import { Head, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import JobBoard from '@/components/job-board';
import JobEstimate, { useEstimatePolling } from '@/components/job-estimate';
import PageHeader from '@/components/page-header';
import QuickJobDialog from '@/components/quick-job-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatJobDates, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index, store, update } from '@/routes/job-queue';
import { show as showJob } from '@/routes/service-records';
import type { SelectOption, ServiceRecord, ServiceRecordPart } from '@/types';

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

export default function JobQueue({
    jobs,
    vehicles,
}: {
    jobs: ServiceRecord[];
    vehicles: SelectOption[];
}) {
    // Moving or filling in a job needs the service log, so only those who
    // can do that may add one.
    const canAddJobs = usePage().props.auth.can.serviceLog;

    useEstimatePolling(
        jobs.map((job) => job.estimate),
        ['jobs'],
    );

    return (
        <>
            <Head title="Job queue" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Job queue"
                    description="Drag a job between columns as it moves from not started, to in progress, to complete."
                    actions={
                        canAddJobs && (
                            <QuickJobDialog
                                form={store.form()}
                                subject={{
                                    name: 'vehicle_id',
                                    label: 'Vehicle',
                                    options: vehicles,
                                    placeholder: 'Pick a vehicle',
                                    unpickedLabel: 'No vehicle yet',
                                }}
                                titlePlaceholder="Replace front brake pads"
                                trigger={
                                    <Button size="sm">
                                        <Plus />
                                        Quick add
                                    </Button>
                                }
                            />
                        )
                    }
                />

                <JobBoard
                    jobs={jobs}
                    moveUrl={(job) => update.url(job.id)}
                    onOpen={(job) => router.visit(showJob(job.id).url)}
                    renderCard={(job) => (
                        <>
                            <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate font-medium">
                                    {job.title}
                                </p>
                                <PartsStatus job={job} />
                            </div>
                            <p className="text-muted-foreground truncate text-xs">
                                {job.vehicle?.display_name ?? 'No vehicle'}
                            </p>
                            <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                                <span className="truncate">
                                    {job.type_label}
                                </span>
                                <span className="shrink-0">
                                    {formatJobDates(job)}
                                </span>
                                {job.status !== 'completed' && (
                                    <JobEstimate
                                        estimate={job.estimate}
                                        compact
                                        className="ml-auto shrink-0 text-[11px]"
                                    />
                                )}
                            </div>
                        </>
                    )}
                />
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

    /**
     * The dialog renders in a portal, but React still passes its clicks and
     * key presses up to the job card, which would open the job. Everything
     * from the box and its dialog stops here instead.
     */
    const keepFromCard = (event: SyntheticEvent) => event.stopPropagation();

    return (
        <span
            className="contents"
            onClick={keepFromCard}
            onKeyDown={keepFromCard}
            onDragStart={keepFromCard}
        >
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        draggable={false}
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
                                        {formatNumber(
                                            part.quantity_outstanding,
                                        )}{' '}
                                        {part.unit_abbreviation} needed
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </span>
    );
}
