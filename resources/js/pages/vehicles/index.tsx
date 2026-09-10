import { Form, Head, Link } from '@inertiajs/react';
import { Car, Gauge, Plus, Search } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate, formatOdometer } from '@/lib/format';
import { create, index, show } from '@/routes/vehicles';
import type { Vehicle } from '@/types';

export default function VehiclesIndex({
    vehicles,
    filters,
}: {
    vehicles: Vehicle[];
    filters: { search: string };
}) {
    return (
        <>
            <Head title="Vehicles" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Vehicles"
                    description="Every machine in the shop, with its history attached."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Add vehicle
                            </Link>
                        </Button>
                    }
                />

                <Form
                    action={index.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    className="relative max-w-sm"
                >
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Search make, model, plate"
                        className="pl-9"
                        aria-label="Search vehicles"
                    />
                </Form>

                {vehicles.length === 0 ? (
                    <EmptyState
                        icon={Car}
                        title={
                            filters.search
                                ? 'No vehicles match that search'
                                : 'No vehicles yet'
                        }
                        description={
                            filters.search
                                ? 'Try a different make, model or plate.'
                                : 'Add the first machine and start logging the work you do on it.'
                        }
                        action={
                            <Button asChild variant="outline">
                                <Link href={create()}>
                                    <Plus />
                                    Add vehicle
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {vehicles.map((vehicle) => (
                            <Link
                                key={vehicle.id}
                                href={show(vehicle.id)}
                                prefetch
                                className="group bg-card hover:border-foreground/40 flex flex-col justify-between gap-5 rounded-xl border p-5 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-lg leading-tight font-semibold">
                                            {vehicle.display_name}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {vehicle.year} {vehicle.make}{' '}
                                            {vehicle.model}
                                            {vehicle.colour
                                                ? ` · ${vehicle.colour}`
                                                : ''}
                                        </p>
                                    </div>
                                    {vehicle.registration && (
                                        <span className="border-foreground/20 rounded border px-2 py-1 font-mono text-xs tracking-widest uppercase">
                                            {vehicle.registration}
                                        </span>
                                    )}
                                </div>

                                <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Jobs
                                        </dt>
                                        <dd className="font-medium tabular-nums">
                                            {vehicle.service_records_count ?? 0}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Spend
                                        </dt>
                                        <dd className="font-medium tabular-nums">
                                            {formatCurrency(vehicle.spend)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Last job
                                        </dt>
                                        <dd className="font-medium">
                                            {formatDate(
                                                vehicle.last_serviced_on,
                                            )}
                                        </dd>
                                    </div>
                                </dl>

                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <Gauge className="size-3.5" />
                                    {formatOdometer(vehicle.odometer)}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

VehiclesIndex.layout = {
    breadcrumbs: [{ title: 'Vehicles', href: index() }],
};
