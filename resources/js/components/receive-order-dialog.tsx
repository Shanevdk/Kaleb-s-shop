import { useForm } from '@inertiajs/react';
import { ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import BarcodeScanDialog from '@/components/barcode-scan-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBarcodeDecoder } from '@/hooks/use-barcode-decoder';
import { formatQuantity } from '@/lib/format';
import { store } from '@/routes/receiving';
import type { DecodedBarcode, PartOrder } from '@/types';

/**
 * Book a delivery in against its order. Scanning the box fills in the code
 * and, for a part the shop has never carried, the description it will be
 * stocked under.
 */
export default function ReceiveOrderDialog({
    order,
    scan,
    onClose,
    onReceived,
}: {
    order: PartOrder;
    scan?: DecodedBarcode | null;
    onClose: () => void;
    onReceived: () => void;
}) {
    const form = useForm({
        quantity: String(order.quantity_outstanding),
        description: describe(order, scan),
        barcode: scan?.barcode ?? order.barcode ?? '',
        brand: scan?.brand ?? '',
    });
    const [scanning, setScanning] = useState(false);
    const [scanNote, setScanNote] = useState<string | null>(() =>
        scan ? noteFor(order, scan) : null,
    );
    const { decodeBarcode, decoding } = useBarcodeDecoder();

    const applyScan = (code: string) => {
        setScanning(false);
        form.setData('barcode', code);
        setScanNote('Looking the code up…');

        decodeBarcode(code)
            .then((decoded) => {
                form.setData((data) => ({
                    ...data,
                    barcode: decoded.barcode,
                    description: describe(order, decoded) || data.description,
                    brand: decoded.brand ?? data.brand,
                }));
                setScanNote(noteFor(order, decoded));
            })
            .catch(() =>
                setScanNote(
                    'Could not reach the decoder. The code is kept; type the description in.',
                ),
            );
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogTitle>Receive {order.name}</DialogTitle>
                <DialogDescription>
                    {formatQuantity(
                        order.quantity_ordered,
                        order.unit_abbreviation,
                    )}{' '}
                    ordered
                    {order.quantity_received > 0 &&
                        `, ${formatQuantity(order.quantity_received, order.unit_abbreviation)} already in`}
                    .{' '}
                    {order.in_inventory
                        ? 'It goes straight onto the shelf.'
                        : 'It is not in the inventory yet, so it is added as a new part.'}
                </DialogDescription>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(store(order.id).url, {
                            preserveScroll: true,
                            onSuccess: onReceived,
                        });
                    }}
                    className="grid gap-4"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="receive_barcode">Barcode</Label>
                        <div className="flex gap-2">
                            <Input
                                id="receive_barcode"
                                value={form.data.barcode}
                                onChange={(event) =>
                                    form.setData('barcode', event.target.value)
                                }
                                onKeyDown={(event) => {
                                    // A USB scanner types the code and hits
                                    // enter; decode it rather than submit.
                                    if (
                                        event.key === 'Enter' &&
                                        form.data.barcode.trim() !== ''
                                    ) {
                                        event.preventDefault();
                                        applyScan(form.data.barcode.trim());
                                    }
                                }}
                                placeholder="Scan or type the code"
                                autoComplete="off"
                                className="font-mono"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setScanning(true)}
                            >
                                <ScanBarcode />
                                Scan
                            </Button>
                        </div>
                        {scanNote && (
                            <p className="text-muted-foreground text-xs">
                                {decoding ? 'Looking the code up…' : scanNote}
                            </p>
                        )}
                        <InputError message={form.errors.barcode} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="receive_description">Description</Label>
                        <Input
                            id="receive_description"
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                            disabled={order.in_inventory}
                            placeholder="Filled in when the code is scanned"
                        />
                        <InputError message={form.errors.description} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="receive_quantity">
                            How many came in ({order.unit_abbreviation})
                        </Label>
                        <Input
                            id="receive_quantity"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={form.data.quantity}
                            onChange={(event) =>
                                form.setData('quantity', event.target.value)
                            }
                            className="tabular-nums"
                        />
                        <InputError message={form.errors.quantity} />
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            Receive into inventory
                        </Button>
                    </DialogFooter>
                </form>

                <BarcodeScanDialog
                    open={scanning}
                    onOpenChange={setScanning}
                    title="Scan the delivery"
                    description="Hold the barcode on the box or part up to the camera."
                    onScan={applyScan}
                    processing={decoding}
                />
            </DialogContent>
        </Dialog>
    );
}

/**
 * The description a scan gives the part. A stocked part keeps its own name.
 */
function describe(
    order: PartOrder,
    scan: DecodedBarcode | null | undefined,
): string {
    if (order.in_inventory) {
        return order.name;
    }

    return scan?.description ?? order.name;
}

/**
 * Say what the scan turned out to be.
 */
function noteFor(order: PartOrder, scan: DecodedBarcode): string {
    if (scan.source === 'inventory') {
        if (
            order.inventory_item_id !== null &&
            scan.inventory_item_id !== order.inventory_item_id
        ) {
            return `That code is on ${scan.description}, not this part. Check the box.`;
        }

        return order.in_inventory
            ? `Matches ${scan.description} on the shelves.`
            : `Already on the shelves as ${scan.description}, so it is booked onto that part.`;
    }

    if (scan.source === 'lookup') {
        return `Decoded: ${[scan.brand, scan.description].filter(Boolean).join(' · ')}.`;
    }

    return 'None of the free barcode databases know this code. Type the description in.';
}
