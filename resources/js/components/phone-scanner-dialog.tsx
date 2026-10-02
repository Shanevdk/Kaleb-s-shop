import { useHttp } from '@inertiajs/react';
import { CheckCircle2, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { poll, store } from '@/routes/phone-scanner';
import type { PhoneScan } from '@/types';

type Pairing = {
    token: string;
    url: string;
    qr: string;
    expires_at: string;
};

type PollResponse = {
    expired: boolean;
    connected: boolean;
    scans: PhoneScan[];
};

/**
 * Show a QR code that turns a phone into a barcode scanner for this page.
 * Every code the phone scans is handed to `onScan`. Unless `continuous` is
 * set, the dialog closes after the first one.
 *
 * The phone's link stays good after the dialog closes, so scans keep coming
 * in until the pairing runs out or the page is left. Opening the dialog again
 * shows the same code rather than starting a new pairing.
 */
export default function PhoneScannerDialog({
    onScan,
    continuous = false,
    label = 'Use my phone',
    size = 'default',
}: {
    onScan: (scan: PhoneScan) => void;
    continuous?: boolean;
    label?: string;
    size?: 'default' | 'sm';
}) {
    const [open, setOpen] = useState(false);
    const [pairing, setPairing] = useState<Pairing | null>(null);
    const [connected, setConnected] = useState(false);
    const [expired, setExpired] = useState(false);
    const [received, setReceived] = useState(0);
    const [error, setError] = useState<string | null>(null);

    /**
     * The newest scan already handed on. Anything at or below it is dropped,
     * so a scan is never booked twice.
     */
    const lastId = useRef(0);

    /**
     * Whether a new code is being made, so opening the dialog twice in a row
     * never starts two pairings.
     */
    const starting = useRef(false);

    const starter = useHttp<Record<string, never>, Pairing>({});
    const checker = useHttp<Record<string, never>, PollResponse>({});

    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    const continuousRef = useRef(continuous);
    continuousRef.current = continuous;

    const start = useCallback(() => {
        if (starting.current) {
            return;
        }

        starting.current = true;
        setPairing(null);
        setConnected(false);
        setExpired(false);
        setReceived(0);
        setError(null);
        lastId.current = 0;

        starter
            .post(store.url(), {
                onHttpException: () => {
                    setError(
                        'Could not make a QR code just now. Try again in a moment.',
                    );

                    return false;
                },
                onNetworkError: () => {
                    setError('Could not reach the server.');

                    return false;
                },
            })
            .then((response) => {
                if (response) {
                    setPairing(response);
                }
            })
            .catch(() => {
                // Already shown through the handlers above.
            })
            .finally(() => {
                starting.current = false;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const live = pairing !== null && !expired;

    // Make a code when the dialog opens, unless the phone is still paired.
    useEffect(() => {
        if (open && !live) {
            start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, start]);

    // For as long as the pairing lasts, open or not, ask every couple of
    // seconds what the phone has sent.
    useEffect(() => {
        if (pairing === null || expired) {
            return;
        }

        /**
         * Set once this pairing is replaced or the page is left, so a poll
         * that comes back late is ignored.
         */
        let stopped = false;

        /**
         * Whether a poll is still waiting on the server, so a slow one is
         * never overlapped by the next tick asking for the same scans.
         */
        let waiting = false;

        const expiresAt = Date.parse(pairing.expires_at);

        const check = () => {
            if (waiting) {
                return;
            }

            if (Date.now() >= expiresAt) {
                setExpired(true);

                return;
            }

            waiting = true;

            checker
                .get(
                    poll.url(pairing.token, {
                        query: { after: lastId.current },
                    }),
                    {
                        onHttpException: () => false,
                        onNetworkError: () => false,
                    },
                )
                .then((response) => {
                    if (stopped || !response) {
                        return;
                    }

                    setConnected(response.connected);

                    if (response.expired) {
                        setExpired(true);

                        return;
                    }

                    const fresh = response.scans.filter(
                        (scan) => scan.id > lastId.current,
                    );

                    for (const scan of fresh) {
                        lastId.current = scan.id;
                        setReceived((count) => count + 1);
                        onScanRef.current(scan);
                    }

                    if (fresh.length > 0 && !continuousRef.current) {
                        setOpen(false);
                    }
                })
                .catch(() => {
                    // Try again on the next tick.
                })
                .finally(() => {
                    waiting = false;
                });
        };

        const timer = window.setInterval(check, 2000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairing, expired]);

    const phoneConnected = live && connected;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size={size}>
                    <Smartphone />
                    {phoneConnected ? 'Phone connected' : label}
                    {phoneConnected && (
                        <span
                            className="size-2 rounded-full bg-emerald-500"
                            aria-hidden="true"
                        />
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogTitle>Scan with your phone</DialogTitle>
                <DialogDescription>
                    Point your phone&rsquo;s camera at this code and open the
                    link. Then scan barcodes with the phone and they show up
                    here. No login needed on the phone. You can close this and
                    keep scanning.
                </DialogDescription>

                <div className="flex flex-col items-center gap-4 py-2">
                    {error ? (
                        <p className="text-destructive text-sm">{error}</p>
                    ) : expired ? (
                        <div className="flex flex-col items-center gap-3 text-center">
                            <p className="text-muted-foreground text-sm">
                                That code has run out.
                            </p>
                            <Button type="button" onClick={start}>
                                <RefreshCw />
                                Make a new code
                            </Button>
                        </div>
                    ) : pairing === null ? (
                        <div className="bg-muted flex size-60 items-center justify-center rounded-xl">
                            <Loader2 className="text-muted-foreground size-6 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <img
                                src={pairing.qr}
                                alt="QR code to open the phone scanner"
                                className="size-60 rounded-xl border bg-white p-2"
                            />
                            <p
                                className="text-muted-foreground flex items-center gap-2 text-sm"
                                aria-live="polite"
                            >
                                {connected ? (
                                    <>
                                        <CheckCircle2 className="size-4 text-emerald-600" />
                                        Phone connected.
                                        {received > 0
                                            ? ` ${received} scanned so far.`
                                            : ' Scan away.'}
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Waiting for the phone…
                                    </>
                                )}
                            </p>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
