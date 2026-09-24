import { CalendarClock, ShieldAlert, Stethoscope } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import type { CommonRepair, MaintenanceInterval, Recall } from '@/types';

/**
 * Everything a mechanic wants to know before opening the bonnet: what is
 * due, what usually goes wrong, and what the maker has recalled.
 */
export default function RepairGuide({
    maintenance,
    repairs,
    recalls,
    showRecalls = true,
}: {
    maintenance: MaintenanceInterval[];
    repairs: CommonRepair[];
    recalls?: Recall[];
    showRecalls?: boolean;
}) {
    return (
        <>
            <MaintenanceSchedule intervals={maintenance} />
            <CommonRepairs repairs={repairs} />
            {showRecalls && <RecallList recalls={recalls} />}
        </>
    );
}

export function MaintenanceSchedule({
    intervals,
}: {
    intervals: MaintenanceInterval[];
}) {
    return (
        <section className="bg-card rounded-xl border">
            <header className="flex items-center gap-3 border-b px-6 py-4">
                <CalendarClock className="text-muted-foreground size-4" />
                <div>
                    <h2 className="font-semibold">Service schedule</h2>
                    <p className="text-muted-foreground text-sm">
                        Conservative intervals for this kind of machine. Follow
                        the maker's book where you have it.
                    </p>
                </div>
            </header>
            <div className="grid gap-px sm:grid-cols-2">
                {intervals.map((interval) => (
                    <div key={interval.interval} className="space-y-2 p-6">
                        <p className="text-xs font-semibold tracking-widest uppercase">
                            {interval.interval}
                        </p>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                            {interval.items.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function CommonRepairs({ repairs }: { repairs: CommonRepair[] }) {
    return (
        <section className="bg-card rounded-xl border">
            <header className="flex items-center gap-3 border-b px-6 py-4">
                <Stethoscope className="text-muted-foreground size-4" />
                <div>
                    <h2 className="font-semibold">Common repairs</h2>
                    <p className="text-muted-foreground text-sm">
                        What these usually come in for, and where to start
                        looking.
                    </p>
                </div>
            </header>
            <ul className="divide-y">
                {repairs.map((repair) => (
                    <li key={repair.symptom} className="space-y-2 px-6 py-4">
                        <p className="font-medium">{repair.symptom}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {repair.causes.map((cause) => (
                                <span
                                    key={cause}
                                    className="bg-muted rounded-full px-2.5 py-0.5 text-xs"
                                >
                                    {cause}
                                </span>
                            ))}
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {repair.fix}
                        </p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function RecallList({ recalls }: { recalls?: Recall[] }) {
    return (
        <section className="bg-card rounded-xl border">
            <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="text-muted-foreground size-4" />
                    <div>
                        <h2 className="font-semibold">Safety recalls</h2>
                        <p className="text-muted-foreground text-sm">
                            Issued for this make, model and year. Checked
                            against NHTSA.
                        </p>
                    </div>
                </div>
                {recalls && (
                    <span className="text-muted-foreground text-sm tabular-nums">
                        {recalls.length} on file
                    </span>
                )}
            </header>

            {recalls === undefined ? (
                <div className="space-y-3 p-6">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            ) : recalls.length === 0 ? (
                <p className="text-muted-foreground p-6 text-sm">
                    No recalls on file for this one.
                </p>
            ) : (
                <ul className="divide-y">
                    {recalls.map((recall) => (
                        <li
                            key={recall.campaign}
                            className="space-y-2 px-6 py-4"
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-medium">
                                    {recall.component ?? 'Recall'}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {recall.campaign}
                                    {recall.date
                                        ? ` · ${formatDate(recall.date)}`
                                        : ''}
                                </p>
                            </div>
                            {recall.summary && (
                                <p className="text-sm">{recall.summary}</p>
                            )}
                            {recall.remedy && (
                                <p className="text-muted-foreground text-sm">
                                    <span className="font-medium">Fix:</span>{' '}
                                    {recall.remedy}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
