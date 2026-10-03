import { Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    CalendarOff,
    Check,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import MarkClosedDialog from '@/components/mark-closed-dialog';
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
import { destroy as reopenDay } from '@/routes/schedule/closed-days';
import type { ClosedDay, ScheduledCheckStatus } from '@/types';

/** What the calendar needs to know about anything booked on a day. */
export type CalendarEntry = {
    id: string;
    kind: string;
    date: string;
    status: ScheduledCheckStatus;
    can_move: boolean;
    window: { from: string; to: string } | null;
};

/** How one kind of entry is labelled and coloured on the calendar. */
export type CalendarKind = { label: string; chip: string; dot: string };

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const statusLabels: Record<ScheduledCheckStatus, string> = {
    done: 'Done',
    in_progress: 'In progress',
    due: 'Today',
    overdue: 'Overdue',
    upcoming: 'Booked',
    missed: 'Missed',
};

export const isBehind = (status: ScheduledCheckStatus) =>
    status === 'overdue' || status === 'missed';

const pad = (value: number) => String(value).padStart(2, '0');

const dateKey = (year: number, month: number, day: number) =>
    `${year}-${pad(month)}-${pad(day)}`;

const shiftMonth = (month: string, by: number) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const shifted = new Date(year, monthNumber - 1 + by, 1);

    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
};

export const longDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

const isSunday = (date: string) => new Date(`${date}T00:00:00`).getDay() === 0;

/**
 * Why the shop is shut on the day, or null when it is open.
 */
export const closedReasonOn = (closedDays: ClosedDay[], date: string) =>
    closedDays.find((closed) => closed.date === date)?.reason ??
    (isSunday(date) ? 'Closed Sundays' : null);

/**
 * The day to open on: today in the current month, otherwise the first day
 * anything is booked.
 */
export const firstDayToShow = (
    month: string,
    today: string,
    entries: CalendarEntry[],
) => (today.startsWith(month) ? today : (entries[0]?.date ?? `${month}-01`));

/**
 * Whether the entry may be dropped on the day: a check has to stay inside
 * the month (or year) it covers, a job can go anywhere.
 */
const canDropOn = (entry: CalendarEntry, date: string) =>
    date !== entry.date &&
    (entry.window === null ||
        (date >= entry.window.from && date <= entry.window.to));

/**
 * Step back and forward a month, and jump back to this one.
 */
export function ScheduleMonthNav({
    month,
    today,
    href,
}: {
    month: string;
    today: string;
    href: (month?: string) => string;
}) {
    const [year, monthNumber] = month.split('-').map(Number);
    const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleDateString(
        'en-US',
        { month: 'long', year: 'numeric' },
    );

    return (
        <>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    asChild
                    aria-label="Previous month"
                >
                    <Link href={href(shiftMonth(month, -1))} preserveScroll>
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
                    <Link href={href(shiftMonth(month, 1))} preserveScroll>
                        <ChevronRight />
                    </Link>
                </Button>
            </div>
            {!today.startsWith(month) && (
                <Button variant="ghost" asChild>
                    <Link href={href()}>Today</Link>
                </Button>
            )}
        </>
    );
}

/**
 * A month on a grid, with whatever is booked on each day. Anything that can
 * move is dragged to another day; dropping it on a day the shop is closed
 * asks first.
 */
export default function ScheduleCalendar<Entry extends CalendarEntry>({
    month,
    today,
    entries,
    closedDays,
    kinds,
    selected,
    onSelect,
    chipLabel,
    describe,
    onMove,
    dragHint,
}: {
    month: string;
    today: string;
    entries: Entry[];
    closedDays: ClosedDay[];
    kinds: Record<Entry['kind'], CalendarKind>;
    selected: string;
    onSelect: (date: string) => void;
    /** What the entry's chip on the grid says. */
    chipLabel: (entry: Entry) => string;
    /** What the entry is called when asking to book it on a closed day. */
    describe: (entry: Entry) => string;
    onMove: (entry: Entry, date: string) => void;
    dragHint: string;
}) {
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const leadingBlanks = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;

    const byDay = entries.reduce<Record<string, Entry[]>>((grouped, entry) => {
        grouped[entry.date] = [...(grouped[entry.date] ?? []), entry];

        return grouped;
    }, {});

    const closedOn = Object.fromEntries(
        closedDays.map((closed) => [closed.date, closed]),
    );

    const [dragging, setDragging] = useState<Entry | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [closedDrop, setClosedDrop] = useState<{
        entry: Entry;
        date: string;
        reason: string;
    } | null>(null);

    const startDrag = (event: DragEvent, entry: Entry) => {
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
        const reason = closedReasonOn(closedDays, date);

        if (reason !== null) {
            setClosedDrop({ entry, date, reason });

            return;
        }

        onMove(entry, date);
    };

    const selectOnKey = (event: KeyboardEvent, date: string) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(date);
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
                        const reason = closedReasonOn(closedDays, date);
                        const droppable =
                            dragging !== null && canDropOn(dragging, date);

                        return (
                            <div
                                key={date}
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelect(date)}
                                onKeyDown={(event) => selectOnKey(event, date)}
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
                                                kinds[
                                                    entry.kind as Entry['kind']
                                                ].dot,
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
                                                kinds[
                                                    entry.kind as Entry['kind']
                                                ].chip,
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
                                                {chipLabel(entry)}
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
                    {(Object.values(kinds) as CalendarKind[]).map((kind) => (
                        <span
                            key={kind.label}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                className={cn('size-2 rounded-full', kind.dot)}
                            />
                            {kind.label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                        <span className="bg-muted size-2 rounded-full border" />
                        Closed (Sundays and Ontario holidays)
                    </span>
                    <span className="hidden md:inline">{dragHint}</span>
                </div>
            </section>

            <Dialog
                open={closedDrop !== null}
                onOpenChange={(open) => !open && setClosedDrop(null)}
            >
                <DialogContent>
                    <DialogTitle>Book it on a closed day?</DialogTitle>
                    <DialogDescription>
                        {closedDrop &&
                            `The shop is closed on ${longDate(closedDrop.date)} (${closedDrop.reason}). Book ${describe(closedDrop.entry)} in anyway?`}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button
                            onClick={() => {
                                if (closedDrop) {
                                    onMove(closedDrop.entry, closedDrop.date);
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

/**
 * The day picked on the calendar: whether the shop is open, and everything
 * booked on it.
 */
export function ScheduleDayPanel({
    date,
    closedDays,
    canManageClosedDays,
    actions,
    isEmpty,
    children,
}: {
    date: string;
    closedDays: ClosedDay[];
    canManageClosedDays: boolean;
    actions: ReactNode;
    isEmpty: boolean;
    children: ReactNode;
}) {
    const reason = closedReasonOn(closedDays, date);
    const markedClosed = closedDays.find((closed) => closed.date === date);

    return (
        <section className="bg-card rounded-xl border">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                <div className="space-y-0.5">
                    <h2 className="font-semibold">{longDate(date)}</h2>
                    {reason !== null && (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <CalendarOff className="size-3.5" />
                            {reason}: nothing is booked in automatically.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canManageClosedDays &&
                        (markedClosed?.id ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    router.delete(
                                        reopenDay.url(
                                            markedClosed.id as string,
                                        ),
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                Open this day
                            </Button>
                        ) : (
                            reason === null && (
                                <MarkClosedDialog
                                    date={date}
                                    label={longDate(date)}
                                    trigger={
                                        <Button variant="ghost" size="sm">
                                            <CalendarOff />
                                            Mark as closed
                                        </Button>
                                    }
                                />
                            )
                        ))}
                    {actions}
                </div>
            </header>

            {isEmpty ? (
                <p className="text-muted-foreground flex items-center gap-2 px-5 py-8 text-sm">
                    <CalendarDays className="size-4" />
                    Nothing booked in for this day.
                </p>
            ) : (
                <ul className="divide-y">{children}</ul>
            )}
        </section>
    );
}
