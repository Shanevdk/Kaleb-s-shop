import { router } from '@inertiajs/react';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import BarcodeScanDialog from '@/components/barcode-scan-dialog';
import { Button } from '@/components/ui/button';
import { barcode } from '@/routes/inventory';
import type { InventoryItem } from '@/types';

/**
 * Scan a QR code or barcode and point it at this part, so scanning it again
 * later books this part in or out.
 */
export default function AssignBarcodeDialog({ item }: { item: InventoryItem }) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    const assign = (code: string) => {
        router.put(
            barcode(item.id).url,
            { barcode: code },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => {
                    setProcessing(true);
                    setError(undefined);
                },
                onSuccess: () => setOpen(false),
                onError: (errors) => setError(errors.barcode),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <BarcodeScanDialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                setError(undefined);
            }}
            trigger={
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Assign a QR code to ${item.name}`}
                >
                    <QrCode />
                </Button>
            }
            title={`Scan a code for ${item.name}`}
            description={
                item.barcode ? (
                    <>
                        It scans as{' '}
                        <span className="font-mono">{item.barcode}</span> right
                        now. A new code replaces it.
                    </>
                ) : (
                    'Hold the QR code or barcode you want on this part up to the camera. Scanning it from then on finds this part.'
                )
            }
            onScan={assign}
            error={error}
            processing={processing}
        />
    );
}
