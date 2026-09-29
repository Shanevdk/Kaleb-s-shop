import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Plus,
    Trash2,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import DeleteConfirm from '@/components/delete-confirm';
import PageHeader from '@/components/page-header';
import RescheduleDialog from '@/components/reschedule-dialog';
import ScheduleJobDialog from '@/components/schedule-job-dialog';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { create as startCheck, show as showCheck } from '@/routes/inspections';
import { index } from '@/routes/schedule';
import { destroy as removeJob } from '@/routes/schedule/jobs';
import { edit as editJob } from '@/routes/service-records';
import type {
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

export default function Schedule({
    month,
    today,
    entries,
    stats,
    vehicles,
    types,
}: {
    month: string;
    today: string;
    entries: ScheduleEntry[];
    stats: ScheduleStats;
    vehicles: SelectOption[];
    types: SelectOption[];
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

                            return (
                                <button
                                    key={date}
                                    type="button"
                                    onClick={() => setSelected(date)}
                                    aria-pressed={selected === date}
                                    aria-label={`${longDate(date)}, ${dayEntries.length} booked`}
                                    className={cn(
                                        'flex min-h-16 flex-col gap-1 border-r border-b p-1.5 text-left transition-colors md:min-h-28 md:p-2',
                                        selected === date
                                            ? 'bg-muted ring-foreground ring-2 ring-inset'
                                            : 'hover:bg-muted/50',
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
                                                className={cn(
                                                    'flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight',
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
                                </button>
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
                    </div>
                </section>

                <section className="bg-card rounded-xl border">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                        <h2 className="font-semibold">{longDate(selected)}</h2>
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
