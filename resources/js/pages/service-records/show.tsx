import { Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    Banknote,
    Clock,
    Package,
    Pencil,
    Trash2,
    Wrench,
} from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    formatCurrency,
    formatDate,
    formatHours,
    formatOdometer,
    formatQuantity,
} from '@/lib/format';
import { destroy, edit, index } from '@/routes/service-records';
import { show as showVehicle } from '@/routes/vehicles';
import type { ServiceRecord } from '@/types';

export default function ServiceRecordShow({
    record,
}: {
    record: ServiceRecord;
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Service log', href: index() },
            { title: record.title, href: '#' },
        ],
    });

    const parts = record.parts ?? [];

    return (
        <>
            <Head title={record.title} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={record.title}
                    description={`${record.type_label} · ${formatDate(record.performed_on)}`}
                    actions={
                        <>
                            {record.vehicle && (
                                <Button variant="outline" asChild>
                                    <Link
                                        href={showVehicle(record.vehicle.id)}
                                    >
                                        View vehicle
                                    </Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={edit(record.id)}>
                                    <Pencil />
                                    Edit
                                </Link>
                            </Button>
                            <DeleteConfirm
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete job"
                                    >
                                        <Trash2 />
                                    </Button>
                                }
                                title="Delete this job?"
                                description={`"${record.title}" will be removed from the service history.`}
                                confirmLabel="Delete job"
                                form={destroy.form(record.id)}
                            />
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                        status={record.status}
                        label={record.status_label}
                    />
                    {record.vehicle && (
                        <Link
                            href={showVehicle(record.vehicle.id)}
                            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                        >
                            {record.vehicle.display_name}
                        </Link>
                    )}
                    {record.odometer !== null && (
                        <span className="text-muted-foreground text-sm">
                            {formatOdometer(record.odometer)}
                        </span>
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Hours"
                        value={formatHours(record.hours)}
                        icon={Clock}
                    />
                    <StatCard
                        label="Parts cost"
                        value={formatCurrency(record.parts_cost)}
                        icon={Package}
                    />
                    <StatCard
                        label="Total cost"
                        value={formatCurrency(record.total_cost)}
                        hint={`Labour ${formatCurrency(record.labour_cost)}`}
                        icon={Banknote}
                    />
                </div>

                {record.description && (
                    <div className="bg-card space-y-2 rounded-xl border p-6">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Notes
                        </h2>
                        <p className="text-sm whitespace-pre-line">
                            {record.description}
                        </p>
                    </div>
                )}

                <section className="bg-card rounded-xl border">
                    <header className="flex items-center justify-between border-b px-6 py-4">
                        <h2 className="font-semibold">Parts used</h2>
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {parts.length} line
                            {parts.length === 1 ? '' : 's'}
                        </span>
                    </header>

                    {parts.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={Wrench}
                                title="No parts logged"
                                description="This job did not use any parts from the shelf."
                            />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead className="text-right">
                                        Quantity
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Taken off shelf
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Outstanding
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parts.map((part) => (
                                    <TableRow key={part.id}>
                                        <TableCell className="font-medium">
                                            {part.name}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatQuantity(
                                                part.quantity,
                                                part.unit_abbreviation,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatQuantity(
                                                part.quantity_taken,
                                                part.unit_abbreviation,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {part.quantity_outstanding > 0 ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950">
                                                    {formatQuantity(
                                                        part.quantity_outstanding,
                                                        part.unit_abbreviation,
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </section>
            </div>
        </>
    );
}
