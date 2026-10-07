import { router } from '@inertiajs/react';
import { ScanQrCode } from 'lucide-react';
import { useState } from 'react';
import BarcodeScanDialog from '@/components/barcode-scan-dialog';
import { Button } from '@/components/ui/button';
import { scan } from '@/routes/equipment';

/**
 * Scan the QR code or barcode on a machine, or the serial number on its
 * plate, and go straight to that machine's page.
 */
export default function EquipmentScanDialog() {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    const lookUp = (code: string) => {
        router.post(
            scan.url(),
            { barcode: code },
            {
                onStart: () => {
                    setProcessing(true);
                    setError(undefined);
                },
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
                <Button variant="outline">
                    <ScanQrCode />
                    Scan
                </Button>
            }
            title="Scan a machine"
            description="Hold its QR code, barcode or serial number plate up to the camera to bring the machine up."
            onScan={lookUp}
            error={error}
            processing={processing}
        />
    );
}
