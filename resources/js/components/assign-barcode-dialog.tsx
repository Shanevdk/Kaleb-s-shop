import { router } from '@inertiajs/react';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import BarcodeScanDialog from '@/components/barcode-scan-dialog';
import { Button } from '@/components/ui/button';

/**
 * Scan a QR code or barcode and point it at a part or a piece of equipment,
 * so scanning it again later brings that one up. `noun` names what it is in
 * the description, such as "part" or "machine".
 */
export default function AssignBarcodeDialog({
    name,
    barcode,
    url,
    noun,
    trigger,
}: {
    name: string;
    barcode: string | null;
    url: string;
    noun: string;
    trigger?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    const assign = (code: string) => {
        router.put(
            url,
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
                trigger ?? (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Assign a QR code to ${name}`}
                    >
                        <QrCode />
                    </Button>
                )
            }
            title={`Scan a code for ${name}`}
            description={
                barcode ? (
                    <>
                        It scans as <span className="font-mono">{barcode}</span>{' '}
                        right now. A new code replaces it.
                    </>
                ) : (
                    `Hold the QR code or barcode you want on this ${noun} up to the camera. Scanning it from then on finds this ${noun}.`
                )
            }
            onScan={assign}
            error={error}
            processing={processing}
        />
    );
}
