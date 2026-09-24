import { Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    ClipboardCheck,
    ClipboardList,
    Clock,
    Package,
    Pencil,
    Plus,
    ShoppingCart,
    Trash2,
    Wrench,
} from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import MachineModel from '@/components/machine-model';
import MachineSpecsList from '@/components/machine-specs';
import PageHeader from '@/components/page-header';
import PhotoCapture from '@/components/photo-capture';
import RepairGuide from '@/components/repair-guide';
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
import {
    create as createInspection,
    show as showInspection,
} from '@/routes/inspections';
import { edit as editPart, index as inventory } from '@/routes/inventory';
import {
    create as createRecord,
    edit as editRecord,
} from '@/routes/service-records';
import { index as shoppingList } from '@/routes/shopping-list';
import { destroy, edit, index, show } from '@/routes/vehicles';
import type {
    CommonRepair,
    Inspection,
    MaintenanceInterval,
    PhotoAngleOption,
    Recall,
    ServiceRecord,
    Vehicle,
    VehiclePart,
} from '@/types';

type Stats = {
    records: number;
    hours: number;
    spend: number;
    open: number;
    needs_attention: number;
};

export default function VehicleShow({
    vehicle,
    records,
    parts,
    inspections,
    photo_angles: photoAngles,
    maintenance,
    repairs,
    recalls,
    stats,
}: {
    vehicle: Vehicle;
    records: ServiceRecord[];
    parts: VehiclePart[];
    inspections: Inspection[];
    photo_angles: PhotoAngleOption[];
    maintenance: MaintenanceInterval[];
    repairs: CommonRepair[];
    recalls?: Recall[];
    stats: Stats;
}) {
    const short = parts.filter((part) => part.shortfall > 0);
    setLayoutProps({
        breadcrumbs: [
            { title: 'Vehicles', href: index() },
            { title: vehicle.display_name, href: show(vehicle.id) },
        ],
    });

    const details = [
        { label: 'Type', value: vehicle.kind_label },
        { label: 'Make', value: vehicle.make },
        { label: 'Model', value: vehicle.model },
        { label: 'Year', value: String(vehicle.year) },
        { label: 'Engine', value: vehicle.engine_summary || '—' },
        { label: 'Colour', value: vehicle.colour || '—' },
        { label: 'Plate', value: vehicle.registration || '—' },
        { label: 'VIN', value: vehicle.vin || '—' },
        { label: 'Odometer', value: formatOdometer(vehicle.odometer) },
    ];

    return (
        <>
            <Head title={vehicle.display_name} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={vehicle.display_name}
                    description={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    actions={
                        <>
                            <Button asChild>
                                <Link
                                    href={createRecord.url({
                                        query: { vehicle: vehicle.id },
                                    })}
                                >
                                    <Plus />
                                    Log job
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link
                                    href={createInspection.url({
                                        query: { vehicle: vehicle.id },
                                    })}
                                >
                                    <ClipboardCheck />
                                    Run checklist
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href={edit(vehicle.id)}>
                                    <Pencil />
                                    Edit
                                </Link>
                            </Button>
                            <DeleteConfirm
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete vehicle"
                                    >
                                        <Trash2 />
                                    </Button>
                                }
                                title={`Delete ${vehicle.display_name}?`}
                                description="This removes the vehicle and every job logged against it. This cannot be undone."
                                confirmLabel="Delete vehicle"
                                form={destroy.form(vehicle.id)}
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
                        hint={`Across ${inspections.length} checklist${inspections.length === 1 ? '' : 's'}`}
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

                        {vehicle.notes && (
                            <div className="mt-6 space-y-2">
                                <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                    Notes
                                </h3>
                                <p className="text-sm whitespace-pre-line">
                                    {vehicle.notes}
                                </p>
                            </div>
                        )}

                        <div className="mt-6 space-y-4 border-t pt-6">
                            <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                Specs
                            </h3>
                            <MachineSpecsList
                                specs={vehicle.specs}
                                engine={vehicle.engine}
                                engineSummary={vehicle.engine_summary}
                                kindLabel={vehicle.kind_label}
                            />
                        </div>
                    </aside>

                    <div className="space-y-6">
                        <MachineModel
                            kind={vehicle.kind}
                            kindLabel={vehicle.kind_label}
                            engine={vehicle.engine}
                            engineSummary={vehicle.engine_summary}
                            doors={vehicle.specs?.doors ?? null}
                            photos={vehicle.photos}
                            photoAngles={photoAngles}
                        />

                        <PhotoCapture
                            vehicleId={vehicle.id}
                            angles={photoAngles}
                            photos={vehicle.photos}
                        />

                        <section className="bg-card rounded-xl border">
                            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                                <div>
                                    <h2 className="font-semibold">
                                        Parts this vehicle takes
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        {short.length > 0
                                            ? `${short.length} of ${parts.length} are short on the shelf.`
                                            : 'Everything it needs is on the shelf.'}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link
                                        href={inventory.url({
                                            query: { vehicle: vehicle.id },
                                        })}
                                    >
                                        <Package />
                                        In inventory
                                    </Link>
                                </Button>
                            </header>

                            {parts.length === 0 ? (
                                <div className="p-6">
                                    <EmptyState
                                        icon={Package}
                                        title="No parts linked yet"
                                        description="Edit a part in your inventory and tick this vehicle to say it fits. Then this list shows what it takes and what you are short."
                                        action={
                                            <Button variant="outline" asChild>
                                                <Link href={inventory()}>
                                                    <Package />
                                                    Open inventory
                                                </Link>
                                            </Button>
                                        }
                                    />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Part</TableHead>
                                            <TableHead className="text-right">
                                                Takes
                                            </TableHead>
                                            <TableHead className="text-right">
                                                On hand
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Short
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parts.map((part) => (
                                            <TableRow key={part.id}>
                                                <TableCell>
                                                    <Link
                                                        href={editPart(part.id)}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {part.name}
                                                    </Link>
                                                    <p className="text-muted-foreground text-xs">
                                                        {part.category_label}
                                                        {part.part_number
                                                            ? ` · ${part.part_number}`
                                                            : ''}
                                                        {part.fitment_notes
                                                            ? ` · ${part.fitment_notes}`
                                                            : ''}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatQuantity(
                                                        part.quantity_needed,
                                                        part.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatQuantity(
                                                        part.quantity,
                                                        part.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {part.shortfall > 0 ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 tabular-nums">
                                                            <AlertTriangle className="size-3" />
                                                            {formatQuantity(
                                                                part.shortfall,
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

                            {short.length > 0 && (
                                <footer className="border-t px-6 py-4">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={shoppingList()}>
                                            <ShoppingCart />
                                            See the full shopping list
                                        </Link>
                                    </Button>
                                </footer>
                            )}
                        </section>

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
                                        description="Record the first job on this vehicle and it will show up here."
                                        action={
                                            <Button variant="outline" asChild>
                                                <Link
                                                    href={createRecord.url({
                                                        query: {
                                                            vehicle: vehicle.id,
                                                        },
                                                    })}
                                                >
                                                    <Plus />
                                                    Log job
                                                </Link>
                                            </Button>
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
                                                    {formatDate(
                                                        record.performed_on,
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <p className="truncate font-medium">
                                                        {record.title}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {record.type_label}
                                                        {record.odometer
                                                            ? ` · ${formatOdometer(record.odometer)}`
                                                            : ''}
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
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={editRecord(
                                                                record.id,
                                                            )}
                                                            aria-label="Edit job"
                                                        >
                                                            <Pencil />
                                                        </Link>
                                                    </Button>
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
                                    {inspections.length} run
                                </span>
                            </header>

                            {inspections.length === 0 ? (
                                <div className="p-6">
                                    <EmptyState
                                        icon={ClipboardCheck}
                                        title="No checklists yet"
                                        description="Run a checklist on this vehicle and every item you mark good, needs attention or fixed is kept here against its name."
                                        action={
                                            <Button variant="outline" asChild>
                                                <Link
                                                    href={createInspection.url({
                                                        query: {
                                                            vehicle: vehicle.id,
                                                        },
                                                    })}
                                                >
                                                    <Plus />
                                                    Start a checklist
                                                </Link>
                                            </Button>
                                        }
                                    />
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {inspections.map((inspection) => (
                                        <li key={inspection.id}>
                                            <Link
                                                href={showInspection(
                                                    inspection.id,
                                                )}
                                                className="hover:bg-muted/50 flex flex-col gap-2 px-6 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium">
                                                        {inspection.title}
                                                    </p>
                                                    <p className="text-muted-foreground text-sm">
                                                        {formatDate(
                                                            inspection.performed_on,
                                                        )}
                                                        {' · '}
                                                        {inspection.checked_count ??
                                                            0}{' '}
                                                        of{' '}
                                                        {inspection.items_count ??
                                                            0}{' '}
                                                        checked
                                                    </p>
                                                </div>

                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    {(inspection.flagged_count ??
                                                        0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 tabular-nums">
                                                            <AlertTriangle className="size-3" />
                                                            {
                                                                inspection.flagged_count
                                                            }{' '}
                                                            need attention
                                                        </span>
                                                    )}
                                                    {(inspection.fixed_count ??
                                                        0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-1 text-xs font-medium text-white tabular-nums dark:bg-sky-500 dark:text-sky-950">
                                                            <Wrench className="size-3" />
                                                            {
                                                                inspection.fixed_count
                                                            }{' '}
                                                            fixed
                                                        </span>
                                                    )}
                                                    {inspection.is_complete && (
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

                        <RepairGuide
                            maintenance={maintenance}
                            repairs={repairs}
                            recalls={recalls}
                            showRecalls={vehicle.kind !== 'trailer'}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
