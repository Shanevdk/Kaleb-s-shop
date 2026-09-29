import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    PackageCheck,
    ScanBarcode,
    ShoppingCart,
    X,
} from 'lucide-react';
import { useState } from 'react';
import BarcodeScanDialog from '@/components/barcode-scan-dialog';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import ReceiveOrderDialog from '@/components/receive-order-dialog';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useBarcodeDecoder } from '@/hooks/use-barcode-decoder';
import { formatDate, formatQuantity } from '@/lib/format';
import { index } from '@/routes/receiving';
import { index as shoppingList } from '@/routes/shopping-list';
import type { DecodedBarcode, PartOrder } from '@/types';

export default function Receiving({
    pending,
    received,
}: {
    pending: PartOrder[];
    received: PartOrder[];
}) {
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState<string>();
    const [lastScan, setLastScan] = useState<DecodedBarcode | null>(null);
    const [receivingOrder, setReceivingOrder] = useState<PartOrder | null>(
        null,
    );
    const { decodeBarcode, decoding } = useBarcodeDecoder();

    /**
     * A scanned box opens its order straight away when the code is already on
     * a stocked part. Otherwise the decoded description waits here until the
     * mechanic picks the order it came in for.
     */
    const handleScan = (code: string) => {
        setScanError(undefined);

        decodeBarcode(code)
            .then((decoded) => {
                const order = pending.find(
                    (candidate) => candidate.id === decoded.part_order_id,
                );

                setScanning(false);
                setLastScan(decoded);

                if (order) {
                    setReceivingOrder(order);
                }
            })
            .catch(() =>
                setScanError(
                    'Could not reach the decoder. Try again in a moment.',
                ),
            );
    };

    return (
        <>
            <Head title="Receive parts" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Receive parts"
                    description="Everything ticked off the shopping list as ordered. Scan what arrives to book it into the inventory."
                    actions={
                        pending.length > 0 && (
                            <BarcodeScanDialog
                                open={scanning}
                                onOpenChange={(open) => {
                                    setScanning(open);
                                    setScanError(undefined);
                                }}
                                trigger={
                                    <Button>
                                        <ScanBarcode />
                                        Scan a delivery
                                    </Button>
                                }
                                title="Scan a delivery"
                                description="Hold the barcode on the box or part up to the camera. The description is filled in for you."
                                onScan={handleScan}
                                error={scanError}
                                processing={decoding}
                            />
                        )
                    }
                />

                {lastScan && !receivingOrder && (
                    <div className="bg-card flex items-start gap-3 rounded-xl border p-4">
                        <ScanBarcode className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium">
                                {lastScan.description ??
                                    'Code not recognised'}
                            </p>
                            <p className="text-muted-foreground font-mono text-xs">
                                {lastScan.barcode}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                No open order is tied to this code yet. Hit
                                Receive on the order it came in for and it is
                                filled in.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Clear the scan"
                            onClick={() => setLastScan(null)}
                        >
                            <X />
                        </Button>
                    </div>
                )}

                {pending.length === 0 ? (
                    <EmptyState
                        icon={PackageCheck}
                        title="Nothing waiting to come in"
                        description="Parts show up here once they are ticked off the shopping list as ordered."
                        action={
                            <Button variant="outline" asChild>
                                <Link href={shoppingList()}>
                                    <ShoppingCart />
                                    Open the shopping list
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <section className="bg-card rounded-xl border">
                        <header className="border-b px-6 py-4">
                            <h2 className="font-semibold">Waiting to arrive</h2>
                            <p className="text-muted-foreground text-sm">
                                Oldest orders first.
                            </p>
                        </header>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead>Ordered</TableHead>
                                    <TableHead className="text-right">
                                        Qty
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Still to come
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <span className="sr-only">
                                            Receive
                                        </span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pending.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="max-w-xs">
                                            <span className="font-medium">
                                                {order.name}
                                            </span>
                                            <p className="text-muted-foreground text-xs">
                                                {order.in_inventory ? (
                                                    [
                                                        order.part_number,
                                                        order.brand,
                                                        order.supplier,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                    'In the inventory'
                                                ) : (
                                                    <span className="text-amber-600 dark:text-amber-500">
                                                        New part, added on
                                                        receipt
                                                    </span>
                                                )}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDate(
                                                order.ordered_at?.slice(0, 10),
                                            )}
                                            {order.ordered_by &&
                                                ` · ${order.ordered_by}`}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatQuantity(
                                                order.quantity_ordered,
                                                order.unit_abbreviation,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatQuantity(
                                                order.quantity_outstanding,
                                                order.unit_abbreviation,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    setReceivingOrder(order)
                                                }
                                            >
                                                <PackageCheck />
                                                Receive
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}

                {received.length > 0 && (
                    <section className="bg-card rounded-xl border">
                        <header className="border-b px-6 py-4">
                            <h2 className="font-semibold">Recently received</h2>
                        </header>

                        <ul className="divide-y">
                            {received.map((order) => (
                                <li
                                    key={order.id}
                                    className="flex items-center gap-3 px-6 py-3"
                                >
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {order.name}
                                        </p>
                                        <p className="text-muted-foreground truncate text-xs">
                                            {formatDate(
                                                order.received_at?.slice(0, 10),
                                            )}
                                            {order.received_by &&
                                                ` · ${order.received_by}`}
                                        </p>
                                    </div>
                                    <p className="shrink-0 text-sm tabular-nums">
                                        {formatQuantity(
                                            order.quantity_received,
                                            order.unit_abbreviation,
                                        )}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {receivingOrder && (
                <ReceiveOrderDialog
                    key={receivingOrder.id}
                    order={receivingOrder}
                    scan={lastScan}
                    onClose={() => setReceivingOrder(null)}
                    onReceived={() => {
                        setReceivingOrder(null);
                        setLastScan(null);
                    }}
                />
            )}
        </>
    );
}

Receiving.layout = {
    breadcrumbs: [{ title: 'Receive parts', href: index() }],
};
