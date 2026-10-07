import { Form, Head, Link, router, setLayoutProps } from '@inertiajs/react';
import { Pencil, Search, Trash2, Wrench } from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import EquipmentServiceRecordDialog from '@/components/equipment-service-record-dialog';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { formatCurrency, formatHours, formatJobDates } from '@/lib/format';
import { show as showEquipment } from '@/routes/equipment';
import { destroy } from '@/routes/equipment-service-records';
import type {
    EquipmentDivision,
    EquipmentServiceRecord,
    SelectOption,
} from '@/types';

type Pagination = {
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function EquipmentServiceRecordsIndex({
    division,
    records,
    pagination,
    equipment,
    types,
    statuses,
    filters,
}: {
    division: EquipmentDivision;
    records: EquipmentServiceRecord[];
    pagination: Pagination;
    equipment: SelectOption[];
    types: SelectOption[];
    statuses: SelectOption[];
    filters: { search: string; status: string; equipment: string };
}) {
    const { serviceLog } = divisionRoutes[division];
    const hasFilters = Boolean(
        filters.search || filters.status || filters.equipment,
    );

    setLayoutProps({
        breadcrumbs: [{ title: 'Equipment service log', href: serviceLog() }],
    });

    return (
        <>
            <Head title="Equipment service log" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Equipment service log"
                    description="Every job logged against any piece of equipment, newest first."
                />

                <Form
                    action={serviceLog.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    className="flex flex-wrap items-center gap-3"
                >
                    <div className="relative min-w-56 flex-1">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search jobs"
                            className="pl-9"
                            aria-label="Search jobs"
                        />
                    </div>

                    <Select
                        name="equipment"
                        defaultValue={filters.equipment || 'all'}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All equipment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All equipment</SelectItem>
                            {equipment.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        name="status"
                        defaultValue={filters.status || 'all'}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any status</SelectItem>
                            {statuses.map((status) => (
                                <SelectItem
                                    key={status.value}
                                    value={status.value}
                                >
                                    {status.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button type="submit" variant="outline">
                        Apply
                    </Button>

                    {hasFilters && (
                        <Button variant="ghost" asChild>
                            <Link href={serviceLog()}>Clear</Link>
                        </Button>
                    )}
                </Form>

                {records.length === 0 ? (
                    <EmptyState
                        icon={Wrench}
                        title={
                            hasFilters
                                ? 'No jobs match those filters'
                                : 'No jobs logged yet'
                        }
                        description={
                            hasFilters
                                ? 'Try widening the search or clearing the filters.'
                                : 'Log a job from a piece of equipment and it will appear in this history.'
                        }
                        action={
                            hasFilters && (
                                <Button variant="outline" asChild>
                                    <Link href={serviceLog()}>
                                        Clear filters
                                    </Link>
                                </Button>
                            )
                        }
                    />
                ) : (
                    <div className="bg-card rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Job</TableHead>
                                    <TableHead>Equipment</TableHead>
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
                                    <TableRow
                                        key={record.id}
                                        onClick={() =>
                                            record.equipment &&
                                            router.visit(
                                                showEquipment(
                                                    record.equipment.id,
                                                ).url,
                                            )
                                        }
                                        className="hover:bg-muted/50 cursor-pointer"
                                    >
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
                                            {record.equipment ? (
                                                <Link
                                                    href={showEquipment(
                                                        record.equipment.id,
                                                    )}
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                    className="underline-offset-4 hover:underline"
                                                >
                                                    {record.equipment.name}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    No machine yet
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={record.status}
                                                label={record.status_label}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatHours(record.hours)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(record.total_cost)}
                                        </TableCell>
                                        <TableCell
                                            className="text-right"
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            <div className="flex justify-end gap-1">
                                                <EquipmentServiceRecordDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Edit job"
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                    }
                                                    equipment={equipment}
                                                    types={types}
                                                    statuses={statuses}
                                                    record={record}
                                                />
                                                <DeleteConfirm
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Delete job"
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    }
                                                    title="Delete this job?"
                                                    description={`"${record.title}" will be removed from the service history.`}
                                                    confirmLabel="Delete job"
                                                    form={destroy.form(
                                                        record.id,
                                                    )}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {pagination.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                            Page {pagination.current_page} of{' '}
                            {pagination.last_page} · {pagination.total} jobs
                        </p>
                        <div className="flex gap-2">
                            {pagination.prev_page_url && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={pagination.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {pagination.next_page_url && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={pagination.next_page_url}>
                                        Next
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
