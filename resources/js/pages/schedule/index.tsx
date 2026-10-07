import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    ClipboardCheck,
    Plus,
    Trash2,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import ChangeDaysDialog from '@/components/change-days-dialog';
import DeleteConfirm from '@/components/delete-confirm';
import PageHeader from '@/components/page-header';
import RescheduleDialog from '@/components/reschedule-dialog';
import ScheduleCalendar, {
    firstDayToShow,
    isBehind,
    ScheduleDayPanel,
    ScheduleMonthNav,
    statusLabels,
} from '@/components/schedule-calendar';
import type { CalendarKind } from '@/components/schedule-calendar';
import ScheduleJobDialog from '@/components/schedule-job-dialog';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { moveJob } from '@/lib/move-job';
import { showFailure } from '@/lib/optimistic';
import { cn } from '@/lib/utils';
import { create as startCheck, show as showCheck } from '@/routes/inspections';
import { index } from '@/routes/schedule';
import {
    destroy as removeCheck,
    update as updateCheck,
} from '@/routes/schedule/checks';
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
    SelectOption,
} from '@/types';

const kinds: Record<ScheduleEntryKind, CalendarKind> = {
    monthly_check: {
        label: 'Monthly check',
        chip: 'border-sky-600/30 bg-sky-600/10 text-sky-800 dark:text-sky-300',
        dot: 'bg-sky-600',
    },
    annual_inspection: {
        label: 'Annual inspection',
        chip: 'border-violet-600/30 bg-violet-600/10 text-violet-800 dark:text-violet-300',
        dot: 'bg-violet-600',
    },
    job: {
        label: 'Job',
        chip: 'border-foreground/20 bg-muted text-foreground',
        dot: 'bg-foreground',
    },
};

/**
 * Move a check or a job to another day. It shows on its new day straight
 * away, and goes back if the move is turned down. A job over several days
 * moves as a whole.
 */
const moveEntry = (entry: ScheduleEntry, date: string) =>
    entry.kind === 'job'
        ? moveJob(updateJob.url(entry.id), entry, date)
        : router
              .optimistic<{ entries: ScheduleEntry[] }>((props) => ({
                  entries: props.entries.map((existing) =>
                      existing.kind === entry.kind && existing.id === entry.id
                          ? { ...existing, date, due_on: date }
                          : existing,
                  ),
              }))
              .patch(
                  updateCheck.url(entry.id),
                  { due_on: date },
                  {
                      preserveScroll: true,
                      showProgress: false,
                      onError: (errors) =>
                          showFailure(errors, 'That could not be moved.'),
                  },
              );

/**
 * Take a check or a job off the calendar straight away while it is being
 * taken off the schedule.
 */
const withoutEntry =
    (entry: ScheduleEntry) => (props: Record<string, unknown>) => ({
        entries: (props.entries as ScheduleEntry[]).filter(
            (existing) =>
                !(existing.kind === entry.kind && existing.id === entry.id),
        ),
    });

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
    const year = Number(month.slice(0, 4));
    const [selected, setSelected] = useState(() =>
        firstDayToShow(month, today, entries),
    );
    const selectedEntries = entries.filter((entry) => entry.date === selected);

    return (
        <>
            <Head title="Mechanic schedule" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Mechanic schedule"
                    description="Every vehicle is booked in for its monthly check and annual inspection automatically. Jobs added here go to the service log as planned work."
                    actions={
                        <>
                            <ScheduleMonthNav
                                month={month}
                                today={today}
                                href={(target) =>
                                    index.url(
                                        target
                                            ? { query: { month: target } }
                                            : undefined,
                                    )
                                }
                            />
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

                <ScheduleCalendar
                    month={month}
                    today={today}
                    entries={entries}
                    closedDays={closedDays}
                    kinds={kinds}
                    selected={selected}
                    onSelect={setSelected}
                    chipLabel={(entry) =>
                        entry.vehicle?.display_name ?? entry.title
                    }
                    describe={(entry) =>
                        entry.kind === 'job'
                            ? entry.title
                            : `${entry.vehicle?.display_name}'s ${entry.title.toLowerCase()}`
                    }
                    onMove={moveEntry}
                    dragHint="Drag a check or job to move it to another day. A job over several days moves as a whole."
                />

                <ScheduleDayPanel
                    date={selected}
                    closedDays={closedDays}
                    canManageClosedDays
                    isEmpty={selectedEntries.length === 0}
                    actions={
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
                    }
                >
                    {selectedEntries.map((entry) => (
                        <ScheduleEntryRow
                            key={`${entry.kind}-${entry.id}`}
                            entry={entry}
                            today={today}
                            canOpenInspections={auth.can.inspections}
                            canOpenJobs={auth.can.serviceLog}
                        />
                    ))}
                </ScheduleDayPanel>
            </div>
        </>
    );
}

function ScheduleEntryRow({
    entry,
    today,
    canOpenInspections,
    canOpenJobs,
}: {
    entry: ScheduleEntry;
    today: string;
    canOpenInspections: boolean;
    canOpenJobs: boolean;
}) {
    const isCheck = entry.kind !== 'job';

    // A check started today only counts if today falls inside its window.
    const canStart =
        canOpenInspections &&
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
                            kinds[entry.kind].chip,
                        )}
                    >
                        {kinds[entry.kind].label}
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
                    {entry.days && entry.days.length > 1 && (
                        <span className="text-muted-foreground text-xs">
                            Day {entry.days.indexOf(entry.date) + 1} of{' '}
                            {entry.days.length}
                        </span>
                    )}
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
                {canOpenInspections && entry.inspection_id && (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={showCheck(entry.inspection_id)}>Open</Link>
                    </Button>
                )}
                {canOpenJobs && entry.service_record_id && (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={editJob(entry.service_record_id)}>
                            Open
                        </Link>
                    </Button>
                )}
                {entry.can_move && isCheck && (
                    <RescheduleDialog
                        id={entry.id}
                        title={entry.title}
                        subject={entry.vehicle?.display_name}
                        form={updateCheck.form(entry.id)}
                        field="due_on"
                        defaultDate={entry.due_on}
                        between={entry.window}
                        trigger={
                            <Button size="sm" variant="outline">
                                <CalendarDays />
                                Move
                            </Button>
                        }
                    />
                )}
                {entry.can_move && !isCheck && (
                    <ChangeDaysDialog
                        id={entry.id}
                        title={entry.title}
                        subject={entry.vehicle?.display_name}
                        form={updateJob.form(entry.id)}
                        days={entry.days ?? [entry.date]}
                        trigger={
                            <Button size="sm" variant="outline">
                                <CalendarDays />
                                Days
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
                        title={
                            isCheck
                                ? `Take this ${kinds[entry.kind].label.toLowerCase()} off the schedule?`
                                : 'Take this job off the schedule?'
                        }
                        description={
                            isCheck
                                ? entry.kind === 'annual_inspection'
                                    ? `${entry.vehicle?.display_name} will not be booked in for an annual inspection again this year.`
                                    : `${entry.vehicle?.display_name} will not be booked in for a monthly check again this month.`
                                : 'Nobody has started it, so it is removed from the service log as well.'
                        }
                        confirmLabel={isCheck ? 'Remove check' : 'Remove job'}
                        form={
                            isCheck
                                ? removeCheck.form(entry.id)
                                : removeJob.form(entry.id)
                        }
                        optimistic={withoutEntry(entry)}
                    />
                )}
            </div>
        </li>
    );
}

Schedule.layout = {
    breadcrumbs: [{ title: 'Mechanic schedule', href: index() }],
};
