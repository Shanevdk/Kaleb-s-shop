import { Head, Link, router, setLayoutProps, usePage } from '@inertiajs/react';
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
import { toast } from 'sonner';
import DeleteConfirm from '@/components/delete-confirm';
import EquipmentScheduleJobDialog from '@/components/equipment-schedule-job-dialog';
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
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { cn } from '@/lib/utils';
import { show as showEquipment } from '@/routes/equipment';
import { show as showChecklist } from '@/routes/equipment-checklists';
import {
    destroy as removeJob,
    update as updateJob,
} from '@/routes/equipment-schedule/jobs';
import type {
    ClosedDay,
    EquipmentDivision,
    EquipmentScheduleEntry,
    EquipmentScheduleEntryKind,
    EquipmentScheduleStats,
    SelectOption,
} from '@/types';

const kinds: Record<EquipmentScheduleEntryKind, CalendarKind> = {
    job: {
        label: 'Maintenance',
        chip: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
        dot: 'bg-emerald-600',
    },
    checklist: {
        label: 'Checklist',
        chip: 'border-sky-600/30 bg-sky-600/10 text-sky-800 dark:text-sky-300',
        dot: 'bg-sky-600',
    },
};

/**
 * Move maintenance to another day.
 */
const moveEntry = (entry: EquipmentScheduleEntry, date: string) =>
    router.patch(
        updateJob.url(entry.id),
        { performed_on: date },
        {
            preserveScroll: true,
            onError: (errors) =>
                toast.error(
                    Object.values(errors)[0] ?? 'That could not be moved.',
                ),
        },
    );

export default function EquipmentSchedule({
    division,
    month,
    today,
    entries,
    stats,
    equipment,
    types,
    closedDays,
}: {
    division: EquipmentDivision;
    month: string;
    today: string;
    entries: EquipmentScheduleEntry[];
    stats: EquipmentScheduleStats;
    equipment: SelectOption[];
    types: SelectOption[];
    closedDays: ClosedDay[];
}) {
    const { auth } = usePage().props;
    const { schedule } = divisionRoutes[division];
    const [selected, setSelected] = useState(() =>
        firstDayToShow(month, today, entries),
    );
    const selectedEntries = entries.filter((entry) => entry.date === selected);

    setLayoutProps({
        breadcrumbs: [
            { title: 'Equipment maintenance schedule', href: schedule() },
        ],
    });

    return (
        <>
            <Head title="Equipment maintenance schedule" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Equipment maintenance schedule"
                    description="Maintenance planned for the shop's equipment, and the checklists run against it. Maintenance added here goes to the equipment service log as planned work."
                    actions={
                        <>
                            <ScheduleMonthNav
                                month={month}
                                today={today}
                                href={(target) =>
                                    schedule.url(
                                        target
                                            ? { query: { month: target } }
                                            : undefined,
                                    )
                                }
                            />
                            <EquipmentScheduleJobDialog
                                equipment={equipment}
                                types={types}
                                defaultDate={selected}
                                trigger={
                                    <Button>
                                        <Plus />
                                        Add maintenance
                                    </Button>
                                }
                            />
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Maintenance this month"
                        value={String(stats.jobs)}
                        hint="Planned, under way and done"
                        icon={Wrench}
                    />
                    <StatCard
                        label="Done"
                        value={`${stats.jobs_done} / ${stats.jobs}`}
                        hint="Maintenance finished this month"
                        icon={CalendarCheck}
                    />
                    <StatCard
                        label="Behind"
                        value={String(stats.behind)}
                        hint="Past its day and not started"
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Checklists this month"
                        value={String(stats.checklists)}
                        hint="Run against any equipment"
                        icon={ClipboardCheck}
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
                    chipLabel={(entry) => entry.equipment?.name ?? entry.title}
                    describe={(entry) =>
                        entry.equipment
                            ? `${entry.equipment.name}'s ${entry.title.toLowerCase()}`
                            : entry.title
                    }
                    onMove={moveEntry}
                    dragHint="Drag maintenance to move it to another day."
                />

                <ScheduleDayPanel
                    date={selected}
                    closedDays={closedDays}
                    canManageClosedDays={auth.can.schedule}
                    isEmpty={selectedEntries.length === 0}
                    actions={
                        <EquipmentScheduleJobDialog
                            equipment={equipment}
                            types={types}
                            defaultDate={selected}
                            trigger={
                                <Button variant="outline" size="sm">
                                    <Plus />
                                    Add maintenance on this day
                                </Button>
                            }
                        />
                    }
                >
                    {selectedEntries.map((entry) => (
                        <EquipmentScheduleEntryRow
                            key={`${entry.kind}-${entry.id}`}
                            entry={entry}
                        />
                    ))}
                </ScheduleDayPanel>
            </div>
        </>
    );
}

function EquipmentScheduleEntryRow({
    entry,
}: {
    entry: EquipmentScheduleEntry;
}) {
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
                        {entry.type_label ?? kinds[entry.kind].label}
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
                <p className="truncate font-medium">{entry.title}</p>
                <p className="text-muted-foreground text-xs">
                    {entry.equipment?.name}
                    {entry.equipment?.location &&
                        ` · ${entry.equipment.location}`}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {entry.checklist_id ? (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={showChecklist(entry.checklist_id)}>
                            Open
                        </Link>
                    </Button>
                ) : (
                    entry.equipment && (
                        <Button size="sm" variant="outline" asChild>
                            <Link href={showEquipment(entry.equipment.id)}>
                                Open
                            </Link>
                        </Button>
                    )
                )}
                {entry.can_move && (
                    <RescheduleDialog
                        id={entry.id}
                        title={entry.title}
                        subject={entry.equipment?.name}
                        form={updateJob.form(entry.id)}
                        field="performed_on"
                        defaultDate={entry.date}
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
                        title="Take this maintenance off the schedule?"
                        description="Nobody has started it, so it is removed from the equipment service log as well."
                        confirmLabel="Remove maintenance"
                        form={removeJob.form(entry.id)}
                    />
                )}
            </div>
        </li>
    );
}
