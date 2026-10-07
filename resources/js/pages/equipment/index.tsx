import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import { Plus, Search, Wrench } from 'lucide-react';
import AmericanFlag from '@/components/american-flag';
import EmptyState from '@/components/empty-state';
import EquipmentScanDialog from '@/components/equipment-scan-dialog';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { formatCurrency, formatDate } from '@/lib/format';
import { show } from '@/routes/equipment';
import type { Equipment, EquipmentDivision } from '@/types';

export default function EquipmentIndex({
    division,
    equipment,
    filters,
}: {
    division: EquipmentDivision;
    equipment: Equipment[];
    filters: { search: string };
}) {
    const { create, index } = divisionRoutes[division];

    setLayoutProps({
        breadcrumbs: [{ title: 'Equipment', href: index() }],
    });

    return (
        <>
            <Head title="Equipment" />

            <div className="relative isolate flex flex-1 flex-col gap-6 p-4 sm:p-6">
                {division === 'usa' && (
                    <AmericanFlag
                        whole
                        preserveAspectRatio="xMinYMin slice"
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 w-full opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)] sm:h-[32rem] dark:opacity-15"
                    />
                )}

                <PageHeader
                    title="Equipment"
                    description="Every tool and machine the shop owns, with its history attached."
                    actions={
                        <>
                            <EquipmentScanDialog />
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add equipment
                                </Link>
                            </Button>
                        </>
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
                        placeholder="Search name, category, serial number"
                        className="bg-background pl-9"
                        aria-label="Search equipment"
                    />
                </Form>

                {equipment.length === 0 ? (
                    <EmptyState
                        icon={Wrench}
                        title={
                            filters.search
                                ? 'No equipment matches that search'
                                : 'No equipment yet'
                        }
                        description={
                            filters.search
                                ? 'Try a different name, category or serial number.'
                                : 'Add the first piece of equipment and start logging the work you do on it.'
                        }
                        action={
                            <Button asChild variant="outline">
                                <Link href={create()}>
                                    <Plus />
                                    Add equipment
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {equipment.map((item) => (
                            <Link
                                key={item.id}
                                href={show(item.id)}
                                prefetch
                                className="group bg-card hover:border-foreground/40 flex flex-col justify-between gap-5 rounded-xl border p-5 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-lg leading-tight font-semibold">
                                            {item.name}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {item.category ?? 'Equipment'}
                                            {item.location
                                                ? ` · ${item.location}`
                                                : ''}
                                        </p>
                                    </div>
                                    <span className="border-foreground/20 rounded border px-2 py-1 text-xs tracking-widest uppercase">
                                        {item.status_label}
                                    </span>
                                </div>

                                <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Jobs
                                        </dt>
                                        <dd className="font-medium tabular-nums">
                                            {item.service_records_count ?? 0}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Spend
                                        </dt>
                                        <dd className="font-medium tabular-nums">
                                            {formatCurrency(item.spend)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                            Last job
                                        </dt>
                                        <dd className="font-medium">
                                            {formatDate(item.last_serviced_on)}
                                        </dd>
                                    </div>
                                </dl>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
