import { Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    ClipboardCheck,
    ClipboardList,
    Clock,
    Pencil,
    Plus,
    Trash2,
    Wrench,
} from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import EquipmentChecklistDialog from '@/components/equipment-checklist-dialog';
import EquipmentServiceRecordDialog from '@/components/equipment-service-record-dialog';
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
import { divisionRoutes } from '@/lib/equipment-divisions';
import {
    formatCurrency,
    formatDate,
    formatHours,
    formatJobDates,
} from '@/lib/format';
import { destroy, edit, show } from '@/routes/equipment';
import { show as showChecklist } from '@/routes/equipment-checklists';
import { destroy as destroyRecord } from '@/routes/equipment-service-records';
import type {
    Equipment,
    EquipmentChecklist,
    EquipmentServiceRecord,
    SelectOption,
} from '@/types';

type Stats = {
    records: number;
    hours: number;
    spend: number;
    open: number;
    needs_attention: number;
};

export default function EquipmentShow({
    equipment,
    checklists,
    records,
    types,
    statuses,
    stats,
}: {
    equipment: Equipment;
    checklists: EquipmentChecklist[];
    records: EquipmentServiceRecord[];
    types: SelectOption[];
    statuses: SelectOption[];
    stats: Stats;
}) {
    const { index } = divisionRoutes[equipment.division];

    setLayoutProps({
        breadcrumbs: [
            { title: 'Equipment', href: index() },
            { title: equipment.name, href: show(equipment.id) },
        ],
    });

    const details = [
        { label: 'Category', value: equipment.category || '—' },
        { label: 'Serial number', value: equipment.serial_number || '—' },
        { label: 'Location', value: equipment.location || '—' },
        { label: 'Status', value: equipment.status_label },
        { label: 'Purchased', value: formatDate(equipment.purchased_on) },
    ];

    return (
        <>
            <Head title={equipment.name} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={equipment.name}
                    description={equipment.category ?? 'Equipment'}
                    actions={
                        <>
                            <EquipmentServiceRecordDialog
                                trigger={
                                    <Button>
                                        <Plus />
                                        Log service record
                                    </Button>
                                }
                                equipmentId={equipment.id}
                                types={types}
                                statuses={statuses}
                            />
                            <EquipmentChecklistDialog
                                trigger={
                                    <Button variant="outline">
                                        <ClipboardCheck />
                                        Start checklist
                                    </Button>
                                }
                                equipmentId={equipment.id}
                            />
                            <Button variant="outline" asChild>
                                <Link href={edit(equipment.id)}>
                                    <Pencil />
                                    Edit
                                </Link>
                            </Button>
                            <DeleteConfirm
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete equipment"
                                    >
                                        <Trash2 />
                                    </Button>
                                }
                                title={`Delete ${equipment.name}?`}
                                description="This removes the equipment and every job and checklist logged against it. This cannot be undone."
                                confirmLabel="Delete equipment"
                                form={destroy.form(equipment.id)}
                            />
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard
                        label="Jobs logged"
                        value={String(stats.records)}
                        icon={ClipboardList}
                    />
                    <StatCard
                        label="Open jobs"
                        value={String(stats.open)}
                        icon={Wrench}
                    />
                    <StatCard
                        label="Needs attention"
                        value={String(stats.needs_attention)}
                        hint={`Across ${checklists.length} checklist${checklists.length === 1 ? '' : 's'}`}
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Hours"
                        value={formatHours(stats.hours)}
                        icon={Clock}
                    />
                    <StatCard
                        label="Total spend"
                        value={formatCurrency(stats.spend)}
                        icon={Banknote}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <aside className="bg-card h-fit rounded-xl border p-6">
                        <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
                            Details
                        </h2>
                        <dl className="space-y-3 text-sm">
                            {details.map((detail) => (
                                <div
                                    key={detail.label}
                                    className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                                >
                                    <dt className="text-muted-foreground">
                                        {detail.label}
                                    </dt>
                                    <dd className="text-right font-medium">
                                        {detail.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>

                        {equipment.notes && (
                            <div className="mt-6 space-y-2">
                                <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                    Notes
                                </h3>
                                <p className="text-sm whitespace-pre-line">
                                    {equipment.notes}
                                </p>
                            </div>
                        )}
                    </aside>

                    <div className="space-y-6">
                        <section className="bg-card rounded-xl border">
                            <header className="flex items-center justify-between border-b px-6 py-4">
                                <h2 className="font-semibold">
                                    Service history
                                </h2>
                                <span className="text-muted-foreground text-sm tabular-nums">
                                    {records.length} entries
                                </span>
                            </header>

                            {records.length === 0 ? (
                                <div className="p-6">
                                    <EmptyState
                                        icon={Wrench}
                                        title="Nothing logged yet"
                                        description="Log the first job on this equipment and it will show up here."
                                        action={
                                            <EquipmentServiceRecordDialog
                                                trigger={
                                                    <Button variant="outline">
                                                        <Plus />
                                                        Log service record
                                                    </Button>
                                                }
                                                equipmentId={equipment.id}
                                                types={types}
                                                statuses={statuses}
                                            />
                                        }
                                    />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Job</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">
                                                Hours
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Cost
                                            </TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {records.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell className="text-muted-foreground">
                                                    {formatJobDates(record)}
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <p className="truncate font-medium">
                                                        {record.title}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {record.type_label}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        status={record.status}
                                                        label={
                                                            record.status_label
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatHours(record.hours)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatCurrency(
                                                        record.total_cost,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <EquipmentServiceRecordDialog
                                                            trigger={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Edit service record"
                                                                >
                                                                    <Pencil />
                                                                </Button>
                                                            }
                                                            types={types}
                                                            statuses={statuses}
                                                            record={record}
                                                        />
                                                        <DeleteConfirm
                                                            trigger={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-muted-foreground hover:text-destructive"
                                                                    aria-label="Remove service record"
                                                                >
                                                                    <Trash2 />
                                                                </Button>
                                                            }
                                                            title="Remove this service record?"
                                                            description="This cannot be undone."
                                                            confirmLabel="Remove"
                                                            form={destroyRecord.form(
                                                                record.id,
                                                            )}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </section>

                        <section className="bg-card rounded-xl border">
                            <header className="flex items-center justify-between border-b px-6 py-4">
                                <h2 className="font-semibold">Checklists</h2>
                                <span className="text-muted-foreground text-sm tabular-nums">
                                    {checklists.length} run
                                </span>
                            </header>

                            {checklists.length === 0 ? (
                                <div className="p-6">
                                    <EmptyState
                                        icon={ClipboardCheck}
                                        title="No checklists yet"
                                        description="Start a checklist on this equipment and every item you mark good, needs attention or fixed is kept here against its name."
                                        action={
                                            <EquipmentChecklistDialog
                                                trigger={
                                                    <Button variant="outline">
                                                        <Plus />
                                                        Start a checklist
                                                    </Button>
                                                }
                                                equipmentId={equipment.id}
                                            />
                                        }
                                    />
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {checklists.map((checklist) => (
                                        <li key={checklist.id}>
                                            <Link
                                                href={showChecklist(
                                                    checklist.id,
                                                )}
                                                className="hover:bg-muted/50 flex flex-col gap-2 px-6 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium">
                                                        {checklist.title}
                                                    </p>
                                                    <p className="text-muted-foreground text-sm">
                                                        {formatDate(
                                                            checklist.performed_on,
                                                        )}
                                                        {' · '}
                                                        {checklist.checked_count ??
                                                            0}{' '}
                                                        of{' '}
                                                        {checklist.items_count ??
                                                            0}{' '}
                                                        checked
                                                    </p>
                                                </div>

                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    {(checklist.flagged_count ??
                                                        0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 tabular-nums">
                                                            <AlertTriangle className="size-3" />
                                                            {
                                                                checklist.flagged_count
                                                            }{' '}
                                                            need attention
                                                        </span>
                                                    )}
                                                    {(checklist.fixed_count ??
                                                        0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-1 text-xs font-medium text-white tabular-nums dark:bg-sky-500 dark:text-sky-950">
                                                            <Wrench className="size-3" />
                                                            {
                                                                checklist.fixed_count
                                                            }{' '}
                                                            fixed
                                                        </span>
                                                    )}
                                                    {checklist.is_complete && (
                                                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                                                            <ClipboardCheck className="size-3" />
                                                            Signed off
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}
