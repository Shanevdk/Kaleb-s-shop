import { router } from '@inertiajs/react';
import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { useState } from 'react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/empty-state';
import { cn } from '@/lib/utils';
import type { ServiceStatus } from '@/types';

const columns: { status: ServiceStatus; title: string; icon: typeof Circle }[] =
    [
        { status: 'planned', title: 'Not started', icon: Circle },
        { status: 'in_progress', title: 'In progress', icon: ListTodo },
        { status: 'completed', title: 'Complete', icon: CheckCircle2 },
    ];

/**
 * A job queue as a board: a column for not started, in progress and
 * complete. A card is dragged to another column to move the job along, and
 * tapped to open it. What a card shows is up to the page, since vehicle and
 * equipment jobs carry different detail.
 */
export default function JobBoard<
    Job extends { id: string; status: ServiceStatus },
>({
    jobs,
    moveUrl,
    onOpen,
    renderCard,
}: {
    jobs: Job[];
    /** Where a job's new column is sent when it is dropped. */
    moveUrl: (job: Job) => string;
    onOpen: (job: Job) => void;
    renderCard: (job: Job) => ReactNode;
}) {
    const onMove = (job: Job, status: ServiceStatus) => {
        router.patch(
            moveUrl(job),
            { status },
            {
                preserveScroll: true,
                onError: (errors) =>
                    toast.error(
                        Object.values(errors)[0] ?? 'That could not be moved.',
                    ),
            },
        );
    };

    const byStatus = jobs.reduce<Record<ServiceStatus, Job[]>>(
        (grouped, job) => {
            grouped[job.status] = [...grouped[job.status], job];

            return grouped;
        },
        { planned: [], in_progress: [], completed: [] },
    );

    const [dragging, setDragging] = useState<Job | null>(null);
    const [dropTarget, setDropTarget] = useState<ServiceStatus | null>(null);

    const startDrag = (event: DragEvent, job: Job) => {
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

        onMove(job, status);
    };

    const openOnKey = (event: KeyboardEvent, job: Job) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(job);
        }
    };

    return (
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
                                        onClick={() => onOpen(job)}
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
                                        {renderCard(job)}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
