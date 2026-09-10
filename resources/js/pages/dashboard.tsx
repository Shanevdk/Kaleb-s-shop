import { Head, Link } from '@inertiajs/react';
import { Banknote, Car, Clock, Plus, Wrench } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatHours } from '@/lib/format';
import { dashboard } from '@/routes';
import {
    create as createRecord,
    edit as editRecord,
    index as recordIndex,
} from '@/routes/service-records';
import {
    create as createVehicle,
    index as vehicleIndex,
    show as showVehicle,
} from '@/routes/vehicles';
import type { ServiceRecord } from '@/types';

type Stats = {
    vehicles: number;
    jobs: number;
    jobs_this_month: number;
    open_jobs: number;
    hours: number;
    spend: number;
    spend_this_month: number;
};

export default function Dashboard({
    stats,
    recentRecords,
    openRecords,
}: {
    stats: Stats;
    recentRecords: ServiceRecord[];
    openRecords: ServiceRecord[];
}) {
    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Workshop overview"
                    description="What is in the shop, what is open and what it has cost."
                    actions={
                        <>
                            <Button asChild>
                                <Link href={createRecord()}>
                                    <Plus />
                                    Log job
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href={createVehicle()}>
                                    <Car />
                                    Add vehicle
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Vehicles"
                        value={String(stats.vehicles)}
                        hint="In your fleet"
                        icon={Car}
                    />
                    <StatCard
                        label="Jobs logged"
                        value={String(stats.jobs)}
                        hint={`${stats.jobs_this_month} this month`}
                        icon={Wrench}
                    />
                    <StatCard
                        label="Hours on tools"
                        value={formatHours(stats.hours)}
                        hint={`${stats.open_jobs} jobs still open`}
                        icon={Clock}
                    />
                    <StatCard
                        label="Total spend"
                        value={formatCurrency(stats.spend)}
                        hint={`${formatCurrency(stats.spend_this_month)} this month`}
                        icon={Banknote}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <section className="bg-card rounded-xl border">
                        <header className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="font-semibold">Latest work</h2>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={recordIndex()}>View all</Link>
                            </Button>
                        </header>

                        {recentRecords.length === 0 ? (
                            <div className="p-6">
                                <EmptyState
                                    icon={Wrench}
                                    title="No jobs logged yet"
                                    description="Once you log work on a vehicle it will show up here."
                                    action={
                                        <Button variant="outline" asChild>
                                            <Link href={createRecord()}>
                                                <Plus />
                                                Log job
                                            </Link>
                                        </Button>
                                    }
                                />
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {recentRecords.map((record) => (
                                    <li key={record.id}>
                                        <Link
                                            href={editRecord(record.id)}
                                            className="hover:bg-muted/50 flex items-center justify-between gap-4 px-6 py-4 transition-colors"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <p className="truncate font-medium">
                                                    {record.title}
                                                </p>
                                                <p className="text-muted-foreground truncate text-sm">
                                                    {record.vehicle
                                                        ?.display_name ??
                                                        '—'}{' '}
                                                    · {record.type_label} ·{' '}
                                                    {formatDate(
                                                        record.performed_on,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-4">
                                                <StatusBadge
                                                    status={record.status}
                                                    label={record.status_label}
                                                />
                                                <span className="w-24 text-right font-medium tabular-nums">
                                                    {formatCurrency(
                                                        record.total_cost,
                                                    )}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="bg-card h-fit rounded-xl border">
                        <header className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="font-semibold">On the ramp</h2>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={vehicleIndex()}>Vehicles</Link>
                            </Button>
                        </header>

                        {openRecords.length === 0 ? (
                            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
                                Nothing planned or in progress. All clear.
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {openRecords.map((record) => (
                                    <li
                                        key={record.id}
                                        className="space-y-2 px-6 py-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-medium">
                                                {record.title}
                                            </p>
                                            <StatusBadge
                                                status={record.status}
                                                label={record.status_label}
                                            />
                                        </div>
                                        {record.vehicle && (
                                            <Link
                                                href={showVehicle(
                                                    record.vehicle.id,
                                                )}
                                                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                                            >
                                                {record.vehicle.display_name}
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
