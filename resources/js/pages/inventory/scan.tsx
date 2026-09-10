import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera as CameraIcon,
    CameraOff,
    CheckCircle2,
    Keyboard,
    Package,
    Plus,
    ScanBarcode,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { formatCurrency } from '@/lib/format';
import { create, index, scan } from '@/routes/inventory';
import { link, store } from '@/routes/inventory/scan';
import type { InventoryItem, SelectOption } from '@/types';

type ScanResult = {
    status: 'matched' | 'unknown';
    barcode: string;
    delta?: number;
    item: InventoryItem | null;
};

type LogEntry = ScanResult & { key: number };

export default function InventoryScan({
    scandit,
    items,
    result,
}: {
    scandit: { license_key: string; library_location: string };
    items: SelectOption[];
    result?: ScanResult;
}) {
    const [log, setLog] = useState<LogEntry[]>([]);
    const [linkTarget, setLinkTarget] = useState('');
    const manualRef = useRef<HTMLInputElement | null>(null);

    /**
     * The last barcode sent to the server, so a scan that is still in flight
     * is not fired again on the next camera frame.
     */
    const pendingRef = useRef<string | null>(null);

    const submitBarcode = (barcode: string) => {
        const trimmed = barcode.trim();

        if (trimmed === '' || pendingRef.current === trimmed) {
            return;
        }

        pendingRef.current = trimmed;

        router.post(
            store.url(),
            { barcode: trimmed, delta: 1 },
            {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    pendingRef.current = null;
                },
            },
        );
    };

    const scanner = useBarcodeScanner({
        licenseKey: scandit.license_key,
        libraryLocation: scandit.library_location,
        onScan: submitBarcode,
    });

    useEffect(() => {
        if (!result) {
            return;
        }

        setLinkTarget('');
        setLog((entries) =>
            [{ ...result, key: Date.now() }, ...entries].slice(0, 20),
        );
    }, [result]);

    const linkBarcode = () => {
        if (!result || linkTarget === '') {
            return;
        }

        router.post(link.url(), {
            barcode: result.barcode,
            inventory_item_id: linkTarget,
            delta: 1,
        });
    };

    const scannerConfigured = scandit.license_key !== '';

    return (
        <>
            <Head title="Scan barcodes" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Scan barcodes"
                    description="Point the camera at a part to book it in. Unknown codes can be linked to a part or added as a new one."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={index()}>Back to inventory</Link>
                        </Button>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                    <section className="bg-card overflow-hidden rounded-xl border">
                        <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
                            <h2 className="font-semibold">Camera</h2>
                            {scannerConfigured &&
                                (scanner.active ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={scanner.stop}
                                    >
                                        <CameraOff />
                                        Stop
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={scanner.start}>
                                        <CameraIcon />
                                        Start camera
                                    </Button>
                                ))}
                        </header>

                        <div className="bg-muted relative aspect-video w-full">
                            <div
                                ref={scanner.hostRef}
                                className="absolute inset-0"
                            />

                            {!scanner.active && (
                                <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                    <ScanBarcode className="size-8" />
                                    {scannerConfigured ? (
                                        <p className="max-w-sm text-sm">
                                            Start the camera and hold a barcode
                                            in view. Every hit books one unit
                                            in.
                                        </p>
                                    ) : (
                                        <div className="max-w-md space-y-2 text-sm">
                                            <p className="text-foreground font-medium">
                                                Camera scanning is not
                                                configured
                                            </p>
                                            <p>
                                                Add your Scandit key as{' '}
                                                <code className="bg-background rounded px-1 py-0.5 font-mono text-xs">
                                                    SCANDIT_LICENSE_KEY
                                                </code>{' '}
                                                in the .env file, then reload.
                                                Until then, use the keyboard
                                                entry on the right — a USB
                                                barcode scanner works there too.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {scanner.status === 'starting' && (
                                <div className="bg-background/70 text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                                    Starting the camera…
                                </div>
                            )}

                            {scanner.status === 'error' && (
                                <div className="bg-background/90 absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                                    <AlertTriangle className="size-6 text-amber-500" />
                                    <p className="font-medium">
                                        The scanner could not start
                                    </p>
                                    <p className="text-muted-foreground max-w-sm text-sm">
                                        {scanner.error}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <div className="bg-card rounded-xl border p-5">
                            <h2 className="mb-3 flex items-center gap-2 font-semibold">
                                <Keyboard className="size-4" />
                                Type or scan a code
                            </h2>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (manualRef.current) {
                                        submitBarcode(manualRef.current.value);
                                        manualRef.current.value = '';
                                    }
                                }}
                                className="grid gap-2"
                            >
                                <Label
                                    htmlFor="barcode"
                                    className="text-muted-foreground text-xs"
                                >
                                    A USB laser scanner types the code and hits
                                    enter, so it works here as-is.
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="barcode"
                                        ref={manualRef}
                                        placeholder="9312345678907"
                                        autoComplete="off"
                                        className="font-mono"
                                    />
                                    <Button type="submit">Look up</Button>
                                </div>
                            </form>
                        </div>

                        {result?.status === 'unknown' && (
                            <div className="bg-card rounded-xl border p-5">
                                <h2 className="mb-1 flex items-center gap-2 font-semibold">
                                    <AlertTriangle className="size-4 text-amber-500" />
                                    Unknown barcode
                                </h2>
                                <p className="text-muted-foreground mb-4 font-mono text-sm">
                                    {result.barcode}
                                </p>

                                {items.length > 0 && (
                                    <div className="mb-4 grid gap-2">
                                        <Label htmlFor="link_target">
                                            Link it to a part you already stock
                                        </Label>
                                        <Select
                                            value={linkTarget || undefined}
                                            onValueChange={setLinkTarget}
                                        >
                                            <SelectTrigger
                                                id="link_target"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Pick a part" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {items.map((item) => (
                                                    <SelectItem
                                                        key={item.value}
                                                        value={item.value}
                                                    >
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={linkBarcode}
                                            disabled={linkTarget === ''}
                                        >
                                            Link and book one in
                                        </Button>
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    asChild
                                >
                                    <Link
                                        href={create.url({
                                            query: { barcode: result.barcode },
                                        })}
                                    >
                                        <Plus />
                                        Add it as a new part
                                    </Link>
                                </Button>
                            </div>
                        )}

                        <div className="bg-card rounded-xl border">
                            <header className="border-b px-5 py-3">
                                <h2 className="font-semibold">This session</h2>
                            </header>

                            {log.length === 0 ? (
                                <p className="text-muted-foreground p-5 text-sm">
                                    Nothing scanned yet.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {log.map((entry) => (
                                        <li
                                            key={entry.key}
                                            className="flex items-center gap-3 px-5 py-3"
                                        >
                                            {entry.status === 'matched' ? (
                                                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                                            ) : (
                                                <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {entry.item?.name ??
                                                        'Unknown barcode'}
                                                </p>
                                                <p className="text-muted-foreground truncate font-mono text-xs">
                                                    {entry.barcode}
                                                </p>
                                            </div>

                                            {entry.item && (
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-semibold tabular-nums">
                                                        {entry.item.quantity}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs tabular-nums">
                                                        {formatCurrency(
                                                            entry.item
                                                                .stock_value,
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {items.length === 0 && (
                            <div className="text-muted-foreground flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm">
                                <Package className="size-5 shrink-0" />
                                <p>
                                    There is nothing in the inventory yet, so
                                    every scan will come back unknown.
                                </p>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

InventoryScan.layout = {
    breadcrumbs: [
        { title: 'Inventory', href: index() },
        { title: 'Scan barcodes', href: scan() },
    ],
};
