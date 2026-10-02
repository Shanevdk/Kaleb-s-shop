import { Form, Head, Link } from '@inertiajs/react';
import { Plus, Search, Wrench } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/format';
import { create, index, show } from '@/routes/equipment';
import type { Equipment } from '@/types';

export default function EquipmentIndex({
    equipment,
    filters,
}: {
    equipment: Equipment[];
    filters: { search: string };
}) {
    return (
        <>
            <Head title="Equipment" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Equipment"
                    description="Every tool and machine the shop owns, with its history attached."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Add equipment
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
                        placeholder="Search name, category, serial number"
                        className="pl-9"
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
                                            {formatDate(
                                                item.last_serviced_on,
                                            )}
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

EquipmentIndex.layout = {
    breadcrumbs: [{ title: 'Equipment', href: index() }],
};
