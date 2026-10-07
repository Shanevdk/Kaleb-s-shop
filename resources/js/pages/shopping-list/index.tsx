import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    CircleSlash,
    ListChecks,
    Package,
    PackageCheck,
    ShoppingCart,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { index as receiving } from '@/routes/receiving';
import { create as addPart, edit as editPart } from '@/routes/inventory';
import { edit as editRecord } from '@/routes/service-records';
import { index } from '@/routes/shopping-list';
import {
    destroy as cancelOrder,
    store as placeOrder,
} from '@/routes/shopping-list/orders';
import type { ShoppingListLine } from '@/types';

type Stats = {
    lines: number;
    not_stocked: number;
    ordered: number;
    jobs: number;
    estimated_cost: number;
};

export default function ShoppingList({
    shortLines,
    reorderLines,
    stats,
}: ShoppingListProps) {
    // Shoppers see the list but cannot open the parts or jobs behind it.
    const { can } = usePage().props.auth;
    const canOpenInventory = can.inventory;
    const canOpenJobs = can.serviceLog;
    const canReceive = can.receiving;

    return (
        <>
            <Head title="Shopping list" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Shopping list"
                    description="What the open jobs need that the shelves cannot cover, plus anything down to its reorder point. Tick a line once it is ordered."
                    actions={
                        canReceive && (
                            <Button variant="outline" asChild>
                                <Link href={receiving()}>
                                    <PackageCheck />
                                    Receive parts
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Lines to buy"
                        value={String(stats.lines)}
                        hint={`${stats.ordered} ordered`}
                        icon={ListChecks}
                    />
                    <StatCard
                        label="Not carried"
                        value={String(stats.not_stocked)}
                        hint="Parts you have never stocked"
                        icon={CircleSlash}
                    />
                    <StatCard
                        label="Jobs waiting"
                        value={String(stats.jobs)}
                        icon={Wrench}
                    />
                    <StatCard
                        label="Rough cost"
                        value={formatCurrency(stats.estimated_cost)}
                        hint="At your recorded unit costs"
                        icon={Banknote}
                    />
                </div>

                {shortLines.length === 0 && reorderLines.length === 0 ? (
                    <EmptyState
                        icon={ShoppingCart}
                        title="Nothing to buy"
                        description="Every part your open jobs call for is on the shelf, and nothing has dropped to its reorder point."
                    />
                ) : (
                    <div className="space-y-6">
                        {shortLines.length > 0 && (
                            <section className="bg-card rounded-xl border">
                                <header className="border-b px-6 py-4">
                                    <h2 className="font-semibold">
                                        Short for open jobs
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        These are holding up work that is
                                        planned or already under way.
                                    </p>
                                </header>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">
                                                Ordered
                                            </TableHead>
                                            <TableHead>Part</TableHead>
                                            <TableHead>Needed for</TableHead>
                                            <TableHead className="text-right">
                                                Need
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Have
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Buy
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Cost
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shortLines.map((line) => (
                                            <TableRow
                                                key={`${line.inventory_item_id ?? 'x'}-${line.name}`}
                                                className={
                                                    line.order
                                                        ? 'bg-muted/40'
                                                        : undefined
                                                }
                                            >
                                                <TableCell className="align-top">
                                                    <OrderToggle line={line} />
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    {line.inventory_item_id &&
                                                    canOpenInventory ? (
                                                        <Link
                                                            href={editPart(
                                                                line.inventory_item_id,
                                                            )}
                                                            className="font-medium hover:underline"
                                                        >
                                                            {line.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium">
                                                            {line.name}
                                                        </span>
                                                    )}
                                                    <p className="text-muted-foreground text-xs">
                                                        {line.in_inventory ? (
                                                            [
                                                                line.part_number,
                                                                line.brand,
                                                                line.supplier,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ') ||
                                                            'In the inventory'
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-500">
                                                                Not in the
                                                                inventory
                                                            </span>
                                                        )}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <div className="flex flex-wrap gap-1">
                                                        {line.jobs?.map(
                                                            (job) => {
                                                                const label = `${job.title}${job.vehicle ? ` · ${job.vehicle}` : ''}`;

                                                                return canOpenJobs ? (
                                                                    <Link
                                                                        key={
                                                                            job.id
                                                                        }
                                                                        href={editRecord(
                                                                            job.id,
                                                                        )}
                                                                        className="bg-muted hover:bg-accent rounded-full px-2 py-0.5 text-xs"
                                                                    >
                                                                        {label}
                                                                    </Link>
                                                                ) : (
                                                                    <span
                                                                        key={
                                                                            job.id
                                                                        }
                                                                        className="bg-muted rounded-full px-2 py-0.5 text-xs"
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatQuantity(
                                                        line.required,
                                                        line.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-right tabular-nums">
                                                    {formatQuantity(
                                                        line.on_hand,
                                                        line.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 tabular-nums">
                                                        <AlertTriangle className="size-3" />
                                                        {formatQuantity(
                                                            line.shortfall,
                                                            line.unit_abbreviation,
                                                        )}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {line.estimated_cost > 0
                                                        ? formatCurrency(
                                                              line.estimated_cost,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {stats.not_stocked > 0 && canOpenInventory && (
                                    <footer className="border-t px-6 py-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href={addPart()}>
                                                <Package />
                                                Add one to inventory
                                            </Link>
                                        </Button>
                                    </footer>
                                )}
                            </section>
                        )}

                        {reorderLines.length > 0 && (
                            <section className="bg-card rounded-xl border">
                                <header className="border-b px-6 py-4">
                                    <h2 className="font-semibold">
                                        Down to the reorder point
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        Not needed for a job yet, but worth
                                        topping up on the next run.
                                    </p>
                                </header>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">
                                                Ordered
                                            </TableHead>
                                            <TableHead>Part</TableHead>
                                            <TableHead className="text-right">
                                                Have
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Reorder at
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Buy
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Cost
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reorderLines.map((line) => (
                                            <TableRow
                                                key={line.inventory_item_id}
                                                className={
                                                    line.order
                                                        ? 'bg-muted/40'
                                                        : undefined
                                                }
                                            >
                                                <TableCell className="align-top">
                                                    <OrderToggle line={line} />
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    {canOpenInventory ? (
                                                        <Link
                                                            href={editPart(
                                                                line.inventory_item_id as string,
                                                            )}
                                                            className="font-medium hover:underline"
                                                        >
                                                            {line.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium">
                                                            {line.name}
                                                        </span>
                                                    )}
                                                    <p className="text-muted-foreground text-xs">
                                                        {[
                                                            line.part_number,
                                                            line.brand,
                                                            line.supplier,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ') || '—'}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatQuantity(
                                                        line.on_hand,
                                                        line.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-right tabular-nums">
                                                    {formatQuantity(
                                                        line.minimum_quantity,
                                                        line.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatQuantity(
                                                        line.shortfall,
                                                        line.unit_abbreviation,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatCurrency(
                                                        line.estimated_cost,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

/**
 * The id a ticked line's order goes by until the server has saved it.
 */
const PENDING_ORDER = 'pending';

type ShoppingListProps = {
    shortLines: ShoppingListLine[];
    reorderLines: ShoppingListLine[];
    stats: Stats;
};

const isSameLine = (one: ShoppingListLine, other: ShoppingListLine) =>
    one.inventory_item_id === other.inventory_item_id &&
    one.name === other.name;

/**
 * How the list looks once a line's order is placed, changed or taken back
 * off, so the tick shows before the server has answered.
 */
const withOrder =
    (line: ShoppingListLine, order: ShoppingListLine['order']) =>
    (props: ShoppingListProps): Partial<ShoppingListProps> => {
        const update = (lines: ShoppingListLine[]) =>
            lines.map((existing) =>
                isSameLine(existing, line) ? { ...existing, order } : existing,
            );

        const shortLines = update(props.shortLines);
        const reorderLines = update(props.reorderLines);

        return {
            shortLines,
            reorderLines,
            stats: {
                ...props.stats,
                ordered: [...shortLines, ...reorderLines].filter(
                    (existing) => existing.order !== null,
                ).length,
            },
        };
    };

/**
 * Tick a line off as ordered and say how many were ordered. Changing the
 * amount on a ticked line updates the order; unticking it takes the order
 * back off, unless part of it has already been received. The tick shows
 * straight away, and goes back if the server turns it down.
 */
function OrderToggle({ line }: { line: ShoppingListLine }) {
    const [quantity, setQuantity] = useState(() =>
        String(line.order?.quantity_ordered ?? line.shortfall),
    );
    const [error, setError] = useState<string>();

    const order = line.order;
    const partlyReceived = (order?.quantity_received ?? 0) > 0;

    const requestOptions = {
        preserveScroll: true,
        preserveState: true,
        showProgress: false,
        onStart: () => setError(undefined),
        onError: (errors: Record<string, string>) =>
            setError(errors.quantity ?? Object.values(errors)[0]),
    };

    const submitOrder = () => {
        router
            .optimistic(
                withOrder(line, {
                    id: order?.id ?? PENDING_ORDER,
                    quantity_ordered: Number(quantity) || 0,
                    quantity_received: order?.quantity_received ?? 0,
                }),
            )
            .post(
                placeOrder.url(),
                {
                    inventory_item_id: line.inventory_item_id,
                    name: line.name,
                    part_number: line.part_number,
                    brand: line.brand,
                    supplier: line.supplier,
                    unit: line.unit,
                    quantity,
                },
                requestOptions,
            );
    };

    const withdrawOrder = () => {
        if (order && order.id !== PENDING_ORDER) {
            router
                .optimistic(withOrder(line, null))
                .delete(cancelOrder(order.id).url, requestOptions);
        }
    };

    return (
        <div className="grid gap-1">
            <div className="flex items-center gap-2">
                <Checkbox
                    checked={order !== null}
                    disabled={partlyReceived || order?.id === PENDING_ORDER}
                    onCheckedChange={(checked) =>
                        checked === true ? submitOrder() : withdrawOrder()
                    }
                    aria-label={`Mark ${line.name} as ordered`}
                />
                <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    onBlur={() => {
                        if (
                            order &&
                            Number(quantity) !== order.quantity_ordered
                        ) {
                            submitOrder();
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            submitOrder();
                        }
                    }}
                    aria-label={`How many ${line.name} were ordered`}
                    className="h-8 w-20 tabular-nums"
                />
                <span className="text-muted-foreground text-xs">
                    {line.unit_abbreviation}
                </span>
            </div>
            {partlyReceived && order && (
                <p className="text-muted-foreground text-xs">
                    {formatQuantity(
                        order.quantity_received,
                        line.unit_abbreviation,
                    )}{' '}
                    received so far
                </p>
            )}
            {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
    );
}

ShoppingList.layout = {
    breadcrumbs: [{ title: 'Shopping list', href: index() }],
};
