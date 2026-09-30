import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    CalendarOff,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Plus,
    Trash2,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { toast } from 'sonner';
import DeleteConfirm from '@/components/delete-confirm';
import MarkClosedDialog from '@/components/mark-closed-dialog';
import PageHeader from '@/components/page-header';
import RescheduleDialog from '@/components/reschedule-dialog';
import ScheduleJobDialog from '@/components/schedule-job-dialog';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { create as startCheck, show as showCheck } from '@/routes/inspections';
import { index } from '@/routes/schedule';
import { update as updateCheck } from '@/routes/schedule/checks';
import { destroy as reopenDay } from '@/routes/schedule/closed-days';
import {
    destroy as removeJob,
    update as updateJob,
} from '@/routes/schedule/jobs';
import { edit as editJob } from '@/routes/service-records';
import type {
    ClosedDay,
    ScheduleEntry,
    ScheduleEntryKind,
    ScheduleStats,
    ScheduledCheckStatus,
    SelectOption,
} from '@/types';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const kindStyles: Record<ScheduleEntryKind, { label: string; chip: string }> = {
    monthly_check: {
        label: 'Monthly check',
        chip: 'border-sky-600/30 bg-sky-600/10 text-sky-800 dark:text-sky-300',
    },
    annual_inspection: {
        label: 'Annual inspection',
        chip: 'border-violet-600/30 bg-violet-600/10 text-violet-800 dark:text-violet-300',
    },
    job: {
        label: 'Job',
        chip: 'border-foreground/20 bg-muted text-foreground',
    },
};

const kindDots: Record<ScheduleEntryKind, string> = {
    monthly_check: 'bg-sky-600',
    annual_inspection: 'bg-violet-600',
    job: 'bg-foreground',
};

const statusLabels: Record<ScheduledCheckStatus, string> = {
    done: 'Done',
    in_progress: 'In progress',
    due: 'Today',
    overdue: 'Overdue',
    upcoming: 'Booked',
    missed: 'Missed',
};

const isBehind = (status: ScheduledCheckStatus) =>
    status === 'overdue' || status === 'missed';

const pad = (value: number) => String(value).padStart(2, '0');

const dateKey = (year: number, month: number, day: number) =>
    `${year}-${pad(month)}-${pad(day)}`;

const shiftMonth = (month: string, by: number) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const shifted = new Date(year, monthNumber - 1 + by, 1);

    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
};

const longDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

const isSunday = (date: string) => new Date(`${date}T00:00:00`).getDay() === 0;

/**
 * Whether the entry may be dropped on the day: a check has to stay inside
 * the month (or year) it covers, a job can go anywhere.
 */
const canDropOn = (entry: ScheduleEntry, date: string) =>
    date !== entry.date &&
    (entry.window === null ||
        (date >= entry.window.from && date <= entry.window.to));

/**
 * Move a check or a job to another day.
 */
const moveEntry = (entry: ScheduleEntry, date: string) => {
    const isJob = entry.kind === 'job';

    router.patch(
        isJob ? updateJob.url(entry.id) : updateCheck.url(entry.id),
        isJob ? { performed_on: date } : { due_on: date },
        {
            preserveScroll: true,
            onError: (errors) =>
                toast.error(
                    Object.values(errors)[0] ?? 'That could not be moved.',
                ),
        },
    );
};

export default function Schedule({
    month,
    today,
    entries,
    stats,
    vehicles,
    types,
    closedDays,
}: {
    month: string;
    today: string;
    entries: ScheduleEntry[];
    stats: ScheduleStats;
    vehicles: SelectOption[];
    types: SelectOption[];
    closedDays: ClosedDay[];
}) {
    const { auth } = usePage().props;
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const leadingBlanks = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleDateString(
        'en-US',
        { month: 'long', year: 'numeric' },
    );

    const byDay = entries.reduce<Record<string, ScheduleEntry[]>>(
        (grouped, entry) => {
            grouped[entry.date] = [...(grouped[entry.date] ?? []), entry];

            return grouped;
        },
        {},
    );

    const [selected, setSelected] = useState(() =>
        today.startsWith(month)
            ? today
            : (entries[0]?.date ?? dateKey(year, monthNumber, 1)),
    );
    const selectedEntries = byDay[selected] ?? [];

    const closedOn = Object.fromEntries(
        closedDays.map((closed) => [closed.date, closed]),
    );
    const closedReason = (date: string) =>
        closedOn[date]?.reason ?? (isSunday(date) ? 'Closed Sundays' : null);
    const selectedClosed = closedOn[selected];

    const [dragging, setDragging] = useState<ScheduleEntry | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [closedDrop, setClosedDrop] = useState<{
        entry: ScheduleEntry;
        date: string;
        reason: string;
    } | null>(null);

    const startDrag = (event: DragEvent, entry: ScheduleEntry) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', entry.id);
        setDragging(entry);
    };

    const endDrag = () => {
        setDragging(null);
        setDropTarget(null);
    };

    const dropOn = (event: DragEvent, date: string) => {
        event.preventDefault();
        const entry = dragging;
        endDrag();

        if (entry === null || !canDropOn(entry, date)) {
            return;
        }

        // Nothing lands on a closed day unless someone says so.
        const reason = closedReason(date);

        if (reason !== null) {
            setClosedDrop({ entry, date, reason });

            return;
        }

        moveEntry(entry, date);
    };

    const selectOnKey = (event: KeyboardEvent, date: string) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelected(date);
        }
    };

    const cells = [
        ...Array.from({ length: leadingBlanks }, () => null),
        ...Array.from({ length: daysInMonth }, (_, day) =>
            dateKey(year, monthNumber, day + 1),
        ),
    ];

    return (
        <>
            <Head title="Schedule" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Schedule"
                    description="Every vehicle is booked in for its monthly check and annual inspection automatically. Jobs added here go to the service log as planned work."
                    actions={
                        <>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    asChild
                                    aria-label="Previous month"
                                >
                                    <Link
                                        href={index({
                                            query: {
                                                month: shiftMonth(month, -1),
                                            },
                                        })}
                                        preserveScroll
                                    >
                                        <ChevronLeft />
                                    </Link>
                                </Button>
                                <span className="w-36 text-center font-semibold">
                                    {monthLabel}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    asChild
                                    aria-label="Next month"
                                >
                                    <Link
                                        href={index({
                                            query: {
                                                month: shiftMonth(month, 1),
                                            },
                                        })}
                                        preserveScroll
                                    >
                                        <ChevronRight />
                                    </Link>
                                </Button>
                            </div>
                            {!today.startsWith(month) && (
                                <Button variant="ghost" asChild>
                                    <Link href={index()}>Today</Link>
                                </Button>
                            )}
                            <ScheduleJobDialog
                                vehicles={vehicles}
                                types={types}
                                defaultDate={selected}
                                trigger={
                                    <Button>
                                        <Plus />
                                        Add job
                                    </Button>
                                }
                            />
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Checks this month"
                        value={`${stats.checks_done} / ${stats.checks}`}
                        hint="Monthly checks and annual inspections"
                        icon={CalendarCheck}
                    />
                    <StatCard
                        label={`Annual inspections ${year}`}
                        value={`${stats.annual_done} / ${stats.annual}`}
                        hint="One thorough going over per vehicle"
                        icon={ClipboardCheck}
                    />
                    <StatCard
                        label="Behind"
                        value={String(stats.behind)}
                        hint="Overdue or missed this month"
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Jobs this month"
                        value={String(stats.jobs)}
                        hint="Planned, under way and done"
                        icon={Wrench}
                    />
                </div>

                <section className="bg-card overflow-hidden rounded-xl border">
                    <div className="text-muted-foreground grid grid-cols-7 border-b text-center text-xs font-medium">
                        {weekdays.map((weekday) => (
                            <div key={weekday} className="py-2">
                                {weekday}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {cells.map((date, position) => {
                            if (date === null) {
                                return (
                                    <div
                                        key={`blank-${position}`}
                                        className="bg-muted/30 min-h-16 border-r border-b md:min-h-28"
                                    />
                                );
                            }

                            const dayEntries = byDay[date] ?? [];
                            const behind = dayEntries.filter((entry) =>
                                isBehind(entry.status),
                            ).length;
                            const reason = closedReason(date);
                            const droppable =
                                dragging !== null && canDropOn(dragging, date);

                            return (
                                <div
                                    key={date}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelected(date)}
                                    onKeyDown={(event) =>
                                        selectOnKey(event, date)
                                    }
                                    onDragOver={(event) => {
                                        if (droppable) {
                                            event.preventDefault();
                                            setDropTarget(date);
                                        }
                                    }}
                                    onDragLeave={() =>
                                        setDropTarget((target) =>
                                            target === date ? null : target,
                                        )
                                    }
                                    onDrop={(event) => dropOn(event, date)}
                                    aria-pressed={selected === date}
                                    aria-label={`${longDate(date)}${reason ? `, ${reason}` : ''}, ${dayEntries.length} booked`}
                                    className={cn(
                                        'flex min-h-16 cursor-pointer flex-col gap-1 border-r border-b p-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset md:min-h-28 md:p-2',
                                        reason !== null &&
                                            'bg-muted/60 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--border)_6px,var(--border)_7px)]',
                                        selected === date
                                            ? 'bg-muted ring-foreground ring-2 ring-inset'
                                            : 'hover:bg-muted/50',
                                        dragging !== null &&
                                            !droppable &&
                                            'opacity-40',
                                        dropTarget === date &&
                                            'bg-sky-600/10 ring-2 ring-sky-600 ring-inset',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                                            date === today &&
                                                'bg-primary text-primary-foreground font-semibold',
                                        )}
                                    >
                                        {Number(date.slice(8))}
                                    </span>

                                    {reason !== null && closedOn[date] && (
                                        <span className="text-muted-foreground hidden truncate text-[11px] leading-tight md:block">
                                            {reason}
                                        </span>
                                    )}

                                    <div className="flex flex-wrap gap-1 md:hidden">
                                        {dayEntries.slice(0, 6).map((entry) => (
                                            <span
                                                key={`${entry.kind}-${entry.id}`}
                                                className={cn(
                                                    'size-1.5 rounded-full',
                                                    kindDots[entry.kind],
                                                    entry.status === 'done' &&
                                                        'opacity-40',
                                                )}
                                            />
                                        ))}
                                    </div>

                                    <div className="hidden min-w-0 flex-col gap-1 md:flex">
                                        {dayEntries.slice(0, 3).map((entry) => (
                                            <span
                                                key={`${entry.kind}-${entry.id}`}
                                                draggable={entry.can_move}
                                                onDragStart={(event) =>
                                                    startDrag(event, entry)
                                                }
                                                onDragEnd={endDrag}
                                                title={
                                                    entry.can_move
                                                        ? 'Drag to another day'
                                                        : undefined
                                                }
                                                className={cn(
                                                    'flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight',
                                                    entry.can_move &&
                                                        'cursor-grab active:cursor-grabbing',
                                                    dragging?.id === entry.id &&
                                                        'opacity-30',
                                                    kindStyles[entry.kind].chip,
                                                    entry.status === 'done' &&
                                                        'opacity-50',
                                                    isBehind(entry.status) &&
                                                        'border-amber-500',
                                                )}
                                            >
                                                {entry.status === 'done' && (
                                                    <Check className="size-3 shrink-0" />
                                                )}
                                                <span className="truncate">
                                                    {entry.vehicle
                                                        ?.display_name ??
                                                        entry.title}
                                                </span>
                                            </span>
                                        ))}
                                        {dayEntries.length > 3 && (
                                            <span className="text-muted-foreground text-[11px]">
                                                +{dayEntries.length - 3} more
                                            </span>
                                        )}
                                    </div>

                                    {behind > 0 && (
                                        <span className="mt-auto hidden text-[11px] font-medium text-amber-600 md:block dark:text-amber-500">
                                            {behind} behind
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-muted-foreground flex flex-wrap gap-4 px-4 py-3 text-xs">
                        {(Object.keys(kindStyles) as ScheduleEntryKind[]).map(
                            (kind) => (
                                <span
                                    key={kind}
                                    className="flex items-center gap-1.5"
                                >
                                    <span
                                        className={cn(
                                            'size-2 rounded-full',
                                            kindDots[kind],
                                        )}
                                    />
                                    {kindStyles[kind].label}
                                </span>
                            ),
                        )}
                        <span className="flex items-center gap-1.5">
                            <span className="bg-muted size-2 rounded-full border" />
                            Closed (Sundays and Ontario holidays)
                        </span>
                        <span className="hidden md:inline">
                            Drag a check or job to move it to another day.
                        </span>
                    </div>
                </section>

                <section className="bg-card rounded-xl border">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                        <div className="space-y-0.5">
                            <h2 className="font-semibold">
                                {longDate(selected)}
                            </h2>
                            {closedReason(selected) !== null && (
                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <CalendarOff className="size-3.5" />
                                    {closedReason(selected)}: nothing is booked
                                    in automatically.
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedClosed?.id ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        router.delete(
                                            reopenDay.url(
                                                selectedClosed.id as string,
                                            ),
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Open this day
                                </Button>
                            ) : (
                                closedReason(selected) === null && (
                                    <MarkClosedDialog
                                        date={selected}
                                        label={longDate(selected)}
                                        trigger={
                                            <Button variant="ghost" size="sm">
                                                <CalendarOff />
                                                Mark as closed
                                            </Button>
                                        }
                                    />
                                )
                            )}
                            <ScheduleJobDialog
                                vehicles={vehicles}
                                types={types}
                                defaultDate={selected}
                                trigger={
                                    <Button variant="outline" size="sm">
                                        <Plus />
                                        Add job on this day
                                    </Button>
                                }
                            />
                        </div>
                    </header>

                    {selectedEntries.length === 0 ? (
                        <p className="text-muted-foreground flex items-center gap-2 px-5 py-8 text-sm">
                            <CalendarDays className="size-4" />
                            Nothing booked in for this day.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {selectedEntries.map((entry) => (
                                <ScheduleEntryRow
                                    key={`${entry.kind}-${entry.id}`}
                                    entry={entry}
                                    today={today}
                                    canWorkOnRecords={auth.can.workOnRecords}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <Dialog
                open={closedDrop !== null}
                onOpenChange={(open) => !open && setClosedDrop(null)}
            >
                <DialogContent>
                    <DialogTitle>Book it on a closed day?</DialogTitle>
                    <DialogDescription>
                        {closedDrop &&
                            `The shop is closed on ${longDate(closedDrop.date)} (${closedDrop.reason}). Book ${
                                closedDrop.entry.kind === 'job'
                                    ? closedDrop.entry.title
                                    : `${closedDrop.entry.vehicle?.display_name}'s ${closedDrop.entry.title.toLowerCase()}`
                            } in anyway?`}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button
                            onClick={() => {
                                if (closedDrop) {
                                    moveEntry(
                                        closedDrop.entry,
                                        closedDrop.date,
                                    );
                                }

                                setClosedDrop(null);
                            }}
                        >
                            Book it anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ScheduleEntryRow({
    entry,
    today,
    canWorkOnRecords,
}: {
    entry: ScheduleEntry;
    today: string;
    canWorkOnRecords: boolean;
}) {
    const isCheck = entry.kind !== 'job';

    // A check started today only counts if today falls inside its window.
    const canStart =
        canWorkOnRecords &&
        entry.inspection_id === null &&
        entry.window !== null &&
        entry.window.from <= today &&
        today <= entry.window.to;

    return (
        <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            'rounded border px-1.5 py-0.5 text-[11px] font-medium',
                            kindStyles[entry.kind].chip,
                        )}
                    >
                        {kindStyles[entry.kind].label}
                    </span>
                    <span
                        className={cn(
                            'text-xs font-medium',
                            isBehind(entry.status)
                                ? 'text-amber-600 dark:text-amber-500'
                                : 'text-muted-foreground',
                        )}
                    >
                        {statusLabels[entry.status]}
                    </span>
                </div>
                <p className="truncate font-medium">
                    {isCheck ? entry.vehicle?.display_name : entry.title}
                </p>
                <p className="text-muted-foreground text-xs">
                    {isCheck
                        ? entry.vehicle?.registration
                        : entry.vehicle?.display_name}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canStart && entry.vehicle && (
                    <Button size="sm" asChild>
                        <Link
                            href={startCheck({
                                query: {
                                    vehicle: entry.vehicle.id,
                                    template: entry.kind,
                                },
                            })}
                        >
                            Start
                        </Link>
                    </Button>
                )}
                {canWorkOnRecords && entry.inspection_id && (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={showCheck(entry.inspection_id)}>Open</Link>
                    </Button>
                )}
                {canWorkOnRecords && entry.service_record_id && (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={editJob(entry.service_record_id)}>
                            Open
                        </Link>
                    </Button>
                )}
                {entry.can_move && (
                    <RescheduleDialog
                        entry={entry}
                        trigger={
                            <Button size="sm" variant="outline">
                                <CalendarDays />
                                Move
                            </Button>
                        }
                    />
                )}
                {entry.can_remove && (
                    <DeleteConfirm
                        trigger={
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Take ${entry.title} off the schedule`}
                            >
                                <Trash2 />
                            </Button>
                        }
                        title="Take this job off the schedule?"
                        description="Nobody has started it, so it is removed from the service log as well."
                        confirmLabel="Remove job"
                        form={removeJob.form(entry.id)}
                    />
                )}
            </div>
        </li>
    );
}

Schedule.layout = {
    breadcrumbs: [{ title: 'Schedule', href: index() }],
};
