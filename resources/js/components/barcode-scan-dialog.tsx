import { usePage } from '@inertiajs/react';
import { AlertTriangle, ScanQrCode } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';

/**
 * Open the camera in a dialog and hand back the QR code or barcode it reads.
 * The box underneath takes a typed code or a USB scanner, which is also the
 * way in when camera scanning is not configured.
 */
export default function BarcodeScanDialog({
    open,
    onOpenChange,
    trigger,
    title,
    description,
    onScan,
    error,
    processing = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger?: ReactNode;
    title: string;
    description: ReactNode;
    onScan: (code: string) => void;
    error?: string;
    processing?: boolean;
}) {
    const manualRef = useRef<HTMLInputElement | null>(null);

    const submitCode = (code: string) => {
        const trimmed = code.trim();

        if (trimmed !== '' && !processing) {
            onScan(trimmed);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

            <DialogContent>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <CameraView onScan={submitCode} />

                {/*
                 * The dialog is portalled, but React still bubbles its submit
                 * event up to any form it was opened from, so stop it here.
                 */}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        if (manualRef.current) {
                            submitCode(manualRef.current.value);
                        }
                    }}
                    className="grid gap-2"
                >
                    <Label htmlFor="scan_dialog_code">Or type the code</Label>
                    <div className="flex gap-2">
                        <Input
                            id="scan_dialog_code"
                            ref={manualRef}
                            placeholder="9312345678907"
                            autoComplete="off"
                            className="font-mono"
                        />
                        <Button type="submit" disabled={processing}>
                            Use code
                        </Button>
                    </div>
                    <InputError message={error} />
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The live camera feed. It only exists while the dialog is open, so closing
 * the dialog shuts the camera off.
 */
function CameraView({ onScan }: { onScan: (code: string) => void }) {
    const { scandit } = usePage().props;

    /**
     * The camera re-reads a code held in view every second and a half, so the
     * same one is only handed back once. A rejected code can still be retried
     * from the box below.
     */
    const lastScannedRef = useRef<string | null>(null);

    const scanner = useBarcodeScanner({
        licenseKey: scandit?.license_key ?? '',
        libraryLocation: scandit?.library_location ?? '',
        autoStart: true,
        onScan: (code) => {
            if (code === lastScannedRef.current) {
                return;
            }

            lastScannedRef.current = code;
            onScan(code);
        },
    });

    if (!scandit?.license_key) {
        return (
            <div className="text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm">
                <ScanQrCode className="size-5 shrink-0" />
                <p>
                    Camera scanning is not set up yet. Type the code below, or
                    click in the box and use a USB scanner.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-lg">
            <div ref={scanner.hostRef} className="absolute inset-0" />

            {scanner.status === 'starting' && (
                <div className="bg-background/70 text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                    Starting the camera…
                </div>
            )}

            {scanner.status === 'error' && (
                <div className="bg-background/90 absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <AlertTriangle className="size-6 text-amber-500" />
                    <p className="font-medium">The camera could not start</p>
                    <p className="text-muted-foreground max-w-sm text-sm">
                        {scanner.error}
                    </p>
                </div>
            )}
        </div>
    );
}
