import { Form, Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    Boxes,
    Car,
    Layers,
    Minus,
    Package,
    Pencil,
    Plus,
    ScanBarcode,
    Search,
    Trash2,
} from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import UseStockDialog from '@/components/use-stock-dialog';
import { formatCurrency, formatNumber, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { adjust, create, destroy, edit, index, scan } from '@/routes/inventory';
import { show as showVehicle } from '@/routes/vehicles';
import type { InventoryItem, SelectOption } from '@/types';

type Filters = {
    search: string;
    category: string;
    vehicle: string;
    low_stock: boolean;
};

type Stats = {
    lines: number;
    units: number;
    low_stock: number;
    value: number;
};

export default function InventoryIndex({
    items,
    categories,
    vehicles,
    filters,
    stats,
}: {
    items: InventoryItem[];
    categories: SelectOption[];
    vehicles: SelectOption[];
    filters: Filters;
    stats: Stats;
}) {
    const applyFilters = (changes: Partial<Filters>) => {
        const next = { ...filters, ...changes };

        router.get(
            index.url({
                query: {
                    search: next.search || undefined,
                    category: next.category || undefined,
                    vehicle: next.vehicle || undefined,
                    low_stock: next.low_stock ? 1 : undefined,
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    const adjustQuantity = (item: InventoryItem, delta: number) => {
        router.patch(
            adjust(item.id).url,
            { delta, vehicle_id: filters.vehicle || null },
            { preserveScroll: true, preserveState: true },
        );
    };

    const isFiltered =
        filters.search !== '' ||
        filters.category !== '' ||
        filters.vehicle !== '' ||
        filters.low_stock;

    return (
        <>
            <Head title="Inventory" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Inventory"
                    description="What is on the shelves, how much of it, and what it is worth."
                    actions={
                        <>
                            <Button asChild>
                                <Link href={scan()}>
                                    <ScanBarcode />
                                    Scan
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add part
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Part lines"
                        value={formatNumber(stats.lines)}
                        icon={Layers}
                    />
                    <StatCard
                        label="Units in stock"
                        value={formatNumber(stats.units)}
                        icon={Boxes}
                    />
                    <StatCard
                        label="Low stock"
                        value={formatNumber(stats.low_stock)}
                        hint="At or below reorder point"
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Stock value"
                        value={formatCurrency(stats.value)}
                        icon={Banknote}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Form
                        action={index.url()}
                        method="get"
                        options={{ preserveState: true, replace: true }}
                        className="relative min-w-56 flex-1 sm:max-w-sm"
                    >
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search name, part number, shelf"
                            className="pl-9"
                            aria-label="Search inventory"
                        />
                        {filters.category && (
                            <input
                                type="hidden"
                                name="category"
                                value={filters.category}
                            />
                        )}
                    </Form>

                    <Select
                        value={filters.category || 'all'}
                        onValueChange={(category) =>
                            applyFilters({
                                category: category === 'all' ? '' : category,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-52"
                            aria-label="Filter by category"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map((category) => (
                                <SelectItem
                                    key={category.value}
                                    value={category.value}
                                >
                                    {category.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={filters.vehicle || 'all'}
                        onValueChange={(vehicle) =>
                            applyFilters({
                                vehicle: vehicle === 'all' ? '' : vehicle,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-52"
                            aria-label="Filter by vehicle it fits"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any vehicle</SelectItem>
                            {vehicles.map((vehicle) => (
                                <SelectItem
                                    key={vehicle.value}
                                    value={vehicle.value}
                                >
                                    Fits {vehicle.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant={filters.low_stock ? 'default' : 'outline'}
                        onClick={() =>
                            applyFilters({ low_stock: !filters.low_stock })
                        }
                    >
                        <AlertTriangle />
                        Low stock only
                    </Button>
                </div>

                {items.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title={
                            isFiltered
                                ? 'Nothing matches those filters'
                                : 'The shelves are empty'
                        }
                        description={
                            isFiltered
                                ? 'Try a different search, category, or clear the low stock filter.'
                                : 'Add the parts and consumables you keep in the shop, with a photo so they are easy to spot.'
                        }
                        action={
                            <Button variant="outline" asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add part
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="bg-card flex flex-col overflow-hidden rounded-xl border"
                            >
                                <div className="bg-muted relative aspect-[4/3] w-full">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            loading="lazy"
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <div className="text-muted-foreground flex size-full items-center justify-center">
                                            <Package className="size-8" />
                                        </div>
                                    )}

                                    {item.is_low_stock && (
                                        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950">
                                            <AlertTriangle className="size-3" />
                                            Low stock
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col gap-4 p-5">
                                    <div className="space-y-1">
                                        <p className="leading-tight font-semibold">
                                            {item.name}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {item.category_label}
                                            {item.brand
                                                ? ` · ${item.brand}`
                                                : ''}
                                        </p>
                                        {item.part_number && (
                                            <p className="text-muted-foreground font-mono text-xs">
                                                {item.part_number}
                                            </p>
                                        )}
                                        {item.barcode && (
                                            <p className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
                                                <ScanBarcode className="size-3" />
                                                {item.barcode}
                                            </p>
                                        )}
                                    </div>

                                    {item.vehicles &&
                                        item.vehicles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.vehicles.map(
                                                    (fitment) => (
                                                        <Link
                                                            key={fitment.id}
                                                            href={showVehicle(
                                                                fitment.id,
                                                            )}
                                                            className="bg-muted hover:bg-accent flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                                                        >
                                                            <Car className="size-3" />
                                                            {
                                                                fitment.display_name
                                                            }
                                                            <span className="text-muted-foreground tabular-nums">
                                                                ·{' '}
                                                                {formatQuantity(
                                                                    fitment.quantity_needed,
                                                                    item.unit_abbreviation,
                                                                )}
                                                            </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        )}

                                    <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                                        <div>
                                            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                                Unit
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {formatCurrency(item.unit_cost)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                                Value
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {formatCurrency(
                                                    item.stock_value,
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                                                Shelf
                                            </dt>
                                            <dd className="font-medium">
                                                {item.location || '—'}
                                            </dd>
                                        </div>
                                    </dl>

                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                                        <div className="flex items-center gap-2">
                                            {item.is_measured ? (
                                                <>
                                                    <UseStockDialog
                                                        item={item}
                                                        vehicles={vehicles}
                                                        defaultVehicle={
                                                            filters.vehicle
                                                        }
                                                    />
                                                    <span
                                                        className={cn(
                                                            'text-lg font-semibold tabular-nums',
                                                            item.is_low_stock &&
                                                                'text-amber-600 dark:text-amber-500',
                                                        )}
                                                    >
                                                        {formatQuantity(
                                                            item.quantity,
                                                            item.unit_abbreviation,
                                                        )}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        aria-label={`Take one ${item.name} off the shelf`}
                                                        disabled={
                                                            item.quantity === 0
                                                        }
                                                        onClick={() =>
                                                            adjustQuantity(
                                                                item,
                                                                -1,
                                                            )
                                                        }
                                                    >
                                                        <Minus />
                                                    </Button>
                                                    <span
                                                        className={cn(
                                                            'w-10 text-center text-lg font-semibold tabular-nums',
                                                            item.is_low_stock &&
                                                                'text-amber-600 dark:text-amber-500',
                                                        )}
                                                    >
                                                        {formatQuantity(
                                                            item.quantity,
                                                        )}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        aria-label={`Put one ${item.name} back on the shelf`}
                                                        onClick={() =>
                                                            adjustQuantity(
                                                                item,
                                                                1,
                                                            )
                                                        }
                                                    >
                                                        <Plus />
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={edit(item.id)}
                                                    aria-label={`Edit ${item.name}`}
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            <DeleteConfirm
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${item.name}`}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                }
                                                title={`Delete ${item.name}?`}
                                                description="This removes the part and its photo from your inventory. This cannot be undone."
                                                confirmLabel="Delete part"
                                                form={destroy.form(item.id)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

InventoryIndex.layout = {
    breadcrumbs: [{ title: 'Inventory', href: index() }],
};
