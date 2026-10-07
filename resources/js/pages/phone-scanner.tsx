import { Head, useHttp } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    ScanBarcode,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import type { PhoneScan } from '@/types';

type Sent = PhoneScan & { key: number };

/**
 * The phone's half of a paired scanner: the camera reads barcodes and each
 * one is sent to the computer that showed the QR code. No login needed; the
 * link itself is the key.
 */
export default function PhoneScanner({
    expired,
    scanUrl,
    scanner,
}: {
    expired: boolean;
    scanUrl: string | null;
    scanner: { license_key: string; library_location: string };
}) {
    const [sent, setSent] = useState<Sent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [linkExpired, setLinkExpired] = useState(expired);
    const manualRef = useRef<HTMLInputElement | null>(null);
    const http = useHttp<{ barcode: string }, PhoneScan>({ barcode: '' });

    /**
     * The camera keeps seeing a code held in view, so the same one is only
     * sent again once it has been out of shot for a few seconds.
     */
    const recent = useRef<{ code: string; at: number } | null>(null);

    const send = (barcode: string) => {
        const code = barcode.trim();

        if (code === '' || scanUrl === null || linkExpired) {
            return;
        }

        if (
            recent.current?.code === code &&
            Date.now() - recent.current.at < 4000
        ) {
            return;
        }

        recent.current = { code, at: Date.now() };
        setError(null);
        navigator.vibrate?.(60);

        http.transform(() => ({ barcode: code }));
        http.post(scanUrl, {
            onHttpException: (response) => {
                if (response.status === 410 || response.status === 403) {
                    setLinkExpired(true);
                } else {
                    setError('That code could not be sent. Try it again.');
                }

                return false;
            },
            onNetworkError: () => {
                setError('No connection. Check the phone is online.');

                return false;
            },
        })
            .then((scan) => {
                if (scan) {
                    setSent((current) =>
                        [{ ...scan, key: Date.now() }, ...current].slice(0, 20),
                    );
                }
            })
            .catch(() => {
                // Already shown through the handlers above.
            });
    };

    const camera = useBarcodeScanner({
        licenseKey: scanner.license_key,
        libraryLocation: scanner.library_location,
        autoStart: !expired,
        onScan: send,
    });

    // Once the link runs out the camera's box goes away, so switch the
    // camera itself off too rather than leave it running unseen.
    useEffect(() => {
        if (linkExpired) {
            camera.stop();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkExpired]);

    const hasCamera = scanner.license_key !== '';

    return (
        <>
            <Head title="Phone scanner" />

            <div className="bg-brand-navy flex min-h-svh flex-col text-white">
                <header className="flex items-center gap-3 px-4 py-3">
                    <span className="bg-brand-charcoal text-brand-steel flex size-9 items-center justify-center rounded-lg">
                        <AppLogoIcon className="size-7 fill-current" />
                    </span>
                    <div className="grid gap-0.5">
                        <AppWordmark className="h-4" onDark />
                        <p className="text-xs text-white/60">
                            Phone scanner · sends to your computer
                        </p>
                    </div>
                </header>

                {linkExpired ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                        <Clock className="text-brand-orange size-10" />
                        <p className="text-lg font-semibold">
                            This link has run out
                        </p>
                        <p className="text-sm text-white/70">
                            On the computer, open the phone scanner again and
                            scan the new QR code.
                        </p>
                    </div>
                ) : (
                    <>
                        {hasCamera ? (
                            <div className="relative aspect-[3/4] max-h-[60svh] w-full bg-black">
                                <div
                                    ref={camera.hostRef}
                                    className="absolute inset-0"
                                />
                                {camera.status === 'starting' && (
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
                                        <Loader2 className="size-4 animate-spin" />
                                        Starting the camera…
                                    </div>
                                )}
                                {camera.status === 'error' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                                        <AlertTriangle className="size-6 text-amber-400" />
                                        <p className="font-medium">
                                            The camera could not start
                                        </p>
                                        <p className="text-sm text-white/70">
                                            {camera.error} Allow camera access
                                            for this site, then reload.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="m-4 flex items-center gap-3 rounded-lg border border-dashed border-white/30 p-4 text-sm text-white/80">
                                <ScanBarcode className="size-5 shrink-0" />
                                Camera scanning is not set up on this shop yet.
                                Type the code below instead.
                            </div>
                        )}

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();

                                if (manualRef.current) {
                                    send(manualRef.current.value);
                                    manualRef.current.value = '';
                                }
                            }}
                            className="flex gap-2 p-4"
                        >
                            <Input
                                ref={manualRef}
                                placeholder="Or type the code"
                                inputMode="numeric"
                                autoComplete="off"
                                className="border-white/20 bg-white/10 font-mono text-white placeholder:text-white/50"
                            />
                            <Button
                                type="submit"
                                className="bg-brand-orange hover:bg-brand-orange/90 text-white"
                            >
                                Send
                            </Button>
                        </form>

                        {error && (
                            <p className="px-4 text-sm text-amber-300">
                                {error}
                            </p>
                        )}

                        <ul className="flex-1 space-y-2 px-4 pb-6">
                            {http.processing && (
                                <li className="flex items-center gap-2 text-sm text-white/70">
                                    <Loader2 className="size-4 animate-spin" />
                                    Sending…
                                </li>
                            )}
                            {sent.map((scan) => (
                                <li
                                    key={scan.key}
                                    className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5"
                                >
                                    <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {scan.description ??
                                                'Unknown product'}
                                        </p>
                                        <p className="truncate font-mono text-xs text-white/60">
                                            {scan.barcode} · sent to the
                                            computer
                                        </p>
                                    </div>
                                </li>
                            ))}
                            {sent.length === 0 && !http.processing && (
                                <li className="text-center text-sm text-white/60">
                                    Point the camera at a barcode. Each one you
                                    scan shows up on the computer.
                                </li>
                            )}
                        </ul>
                    </>
                )}
            </div>
        </>
    );
}
