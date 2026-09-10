import { Form, Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
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
import { formatCurrency, formatDate, formatHours } from '@/lib/format';
import { create, destroy, edit, index } from '@/routes/service-records';
import { show as showVehicle } from '@/routes/vehicles';
import type { SelectOption, ServiceRecord } from '@/types';

type Pagination = {
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function ServiceRecordsIndex({
    records,
    pagination,
    vehicles,
    statuses,
    filters,
}: {
    records: ServiceRecord[];
    pagination: Pagination;
    vehicles: SelectOption[];
    statuses: SelectOption[];
    filters: { search: string; status: string; vehicle: string };
}) {
    const hasFilters = Boolean(
        filters.search || filters.status || filters.vehicle,
    );

    return (
        <>
            <Head title="Service log" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Service log"
                    description="Every job you have carried out, newest first."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Log job
                            </Link>
                        </Button>
                    }
                />

                <Form
                    action={index.url()}
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
                        name="vehicle"
                        defaultValue={filters.vehicle || 'all'}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All vehicles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All vehicles</SelectItem>
                            {vehicles.map((vehicle) => (
                                <SelectItem
                                    key={vehicle.value}
                                    value={vehicle.value}
                                >
                                    {vehicle.label}
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
                            <Link href={index()}>Clear</Link>
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
                                : 'Log your first job and it will appear in this history.'
                        }
                        action={
                            <Button variant="outline" asChild>
                                <Link href={hasFilters ? index() : create()}>
                                    {hasFilters ? 'Clear filters' : 'Log job'}
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="bg-card rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Job</TableHead>
                                    <TableHead>Vehicle</TableHead>
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
                                            {formatDate(record.performed_on)}
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
                                            {record.vehicle && (
                                                <Link
                                                    href={showVehicle(
                                                        record.vehicle.id,
                                                    )}
                                                    className="underline-offset-4 hover:underline"
                                                >
                                                    {
                                                        record.vehicle
                                                            .display_name
                                                    }
                                                </Link>
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
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                >
                                                    <Link
                                                        href={edit(record.id)}
                                                        aria-label="Edit job"
                                                    >
                                                        <Pencil />
                                                    </Link>
                                                </Button>
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

ServiceRecordsIndex.layout = {
    breadcrumbs: [{ title: 'Service log', href: index() }],
};
