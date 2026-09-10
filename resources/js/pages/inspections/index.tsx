import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, ClipboardCheck, Plus } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { create, index, show } from '@/routes/inspections';
import type { Inspection, SelectOption } from '@/types';

export default function InspectionsIndex({
    inspections,
    vehicles,
    filters,
}: {
    inspections: Inspection[];
    vehicles: SelectOption[];
    filters: { vehicle: string };
}) {
    const filterByVehicle = (vehicle: string) => {
        router.get(
            index.url({
                query: { vehicle: vehicle === 'all' ? undefined : vehicle },
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            <Head title="Checklists" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Checklists"
                    description="Pick a vehicle, work down the list, sign it off."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Start checklist
                            </Link>
                        </Button>
                    }
                />

                {vehicles.length > 0 && (
                    <Select
                        value={filters.vehicle || 'all'}
                        onValueChange={filterByVehicle}
                    >
                        <SelectTrigger
                            className="w-full max-w-sm"
                            aria-label="Filter by vehicle"
                        >
                            <SelectValue />
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
                )}

                {inspections.length === 0 ? (
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No checklists yet"
                        description="Start one against a vehicle and every item to check gets laid out for you."
                        action={
                            <Button variant="outline" asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Start checklist
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {inspections.map((inspection) => {
                            const total = inspection.items_count ?? 0;
                            const done = inspection.checked_count ?? 0;
                            const progress = total
                                ? Math.round((done / total) * 100)
                                : 0;

                            return (
                                <Link
                                    key={inspection.id}
                                    href={show(inspection.id)}
                                    prefetch
                                    className="bg-card hover:border-foreground/40 flex flex-col gap-4 rounded-xl border p-5 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="leading-tight font-semibold">
                                                {inspection.title}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                {
                                                    inspection.vehicle
                                                        ?.display_name
                                                }
                                            </p>
                                        </div>
                                        <span className="text-muted-foreground shrink-0 text-xs">
                                            {formatDate(
                                                inspection.performed_on,
                                            )}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full"
                                                style={{
                                                    width: `${progress}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-muted-foreground text-xs tabular-nums">
                                            {done} of {total} checked
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
                                        <span
                                            className={
                                                inspection.is_complete
                                                    ? 'font-medium'
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {inspection.is_complete
                                                ? 'Signed off'
                                                : 'In progress'}
                                        </span>
                                        {(inspection.flagged_count ?? 0) >
                                            0 && (
                                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                                <AlertTriangle className="size-3.5" />
                                                {inspection.flagged_count} need
                                                work
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

InspectionsIndex.layout = {
    breadcrumbs: [{ title: 'Checklists', href: index() }],
};
