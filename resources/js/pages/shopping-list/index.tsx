import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    CircleSlash,
    ListChecks,
    Package,
    ShoppingCart,
    Wrench,
} from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { create as addPart, edit as editPart } from '@/routes/inventory';
import { edit as editRecord } from '@/routes/service-records';
import { index } from '@/routes/shopping-list';
import type { ShoppingListLine } from '@/types';

type Stats = {
    lines: number;
    not_stocked: number;
    jobs: number;
    estimated_cost: number;
};

export default function ShoppingList({
    shortLines,
    reorderLines,
    stats,
}: {
    shortLines: ShoppingListLine[];
    reorderLines: ShoppingListLine[];
    stats: Stats;
}) {
    return (
        <>
            <Head title="Shopping list" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Shopping list"
                    description="What the open jobs need that the shelves cannot cover, plus anything down to its reorder point."
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Lines to buy"
                        value={String(stats.lines)}
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
                                            >
                                                <TableCell className="max-w-xs">
                                                    {line.inventory_item_id ? (
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
                                                            'In your inventory'
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-500">
                                                                Not in your
                                                                inventory
                                                            </span>
                                                        )}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <div className="flex flex-wrap gap-1">
                                                        {line.jobs?.map(
                                                            (job) => (
                                                                <Link
                                                                    key={job.id}
                                                                    href={editRecord(
                                                                        job.id,
                                                                    )}
                                                                    className="bg-muted hover:bg-accent rounded-full px-2 py-0.5 text-xs"
                                                                >
                                                                    {job.title}
                                                                    {job.vehicle
                                                                        ? ` · ${job.vehicle}`
                                                                        : ''}
                                                                </Link>
                                                            ),
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

                                {stats.not_stocked > 0 && (
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
                                            >
                                                <TableCell className="max-w-xs">
                                                    <Link
                                                        href={editPart(
                                                            line.inventory_item_id as string,
                                                        )}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {line.name}
                                                    </Link>
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

ShoppingList.layout = {
    breadcrumbs: [{ title: 'Shopping list', href: index() }],
};
