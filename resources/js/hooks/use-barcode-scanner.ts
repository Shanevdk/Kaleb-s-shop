import type { DetectedBarcode } from 'barcode-detector/ponyfill';
import { useEffect, useRef, useState } from 'react';
import { canonicalBarcode } from '@/lib/barcode-format';

/**
 * The symbologies worth reading in a workshop: retail codes on boxed parts,
 * Code 128/39/93 and Interleaved 2 of 5 on supplier labels, and QR / Data
 * Matrix on newer packaging and on the codes stuck to machines.
 */
const WORKSHOP_FORMATS = [
    'ean_13',
    'upc_a',
    'ean_8',
    'upc_e',
    'code_128',
    'code_39',
    'code_93',
    'itf',
    'qr_code',
    'data_matrix',
] as const;

/**
 * A code held in view is only handed back again once this long has passed
 * since it last was.
 */
const DUPLICATE_FILTER_MS = 1500;

/**
 * The pause between looks at the camera feed. Short enough to feel
 * instant, long enough to leave a phone's CPU room for everything else.
 */
const SCAN_INTERVAL_MS = 120;

/**
 * How long the outline stays drawn round a code that was just read.
 */
const HIGHLIGHT_MS = 600;

type Detector = {
    detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type NativeBarcodeDetector = {
    new (options: { formats: string[] }): Detector;
    getSupportedFormats: () => Promise<string[]>;
};

/**
 * Get something that reads barcodes out of a video frame. The browser's own
 * reader is used where it can read every workshop format (Chrome on
 * Android); everywhere else, including every iPhone, the open-source ZXing
 * engine is loaded instead. It is fetched the first time the camera is
 * opened, from the app itself, so pages that offer scanning stay quick to
 * load for everyone who never presses the button.
 */
async function createDetector(): Promise<Detector> {
    const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetector })
        .BarcodeDetector;

    if (Native) {
        try {
            const supported = await Native.getSupportedFormats();

            if (
                WORKSHOP_FORMATS.every((format) => supported.includes(format))
            ) {
                return new Native({ formats: [...WORKSHOP_FORMATS] });
            }
        } catch {
            // Fall through to ZXing.
        }
    }

    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] =
        await Promise.all([
            import('barcode-detector/ponyfill'),
            import('zxing-wasm/reader/zxing_reader.wasm?url'),
        ]);

    await prepareZXingModule({
        overrides: {
            locateFile: (path: string, prefix: string) =>
                path.endsWith('.wasm') ? wasmUrl : prefix + path,
        },
        fireImmediately: true,
    });

    return new BarcodeDetector({ formats: [...WORKSHOP_FORMATS] });
}

/**
 * Turn whatever went wrong opening the camera into something a person can
 * act on.
 */
function describeCameraError(thrown: unknown): string {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        return 'The camera only works over a secure (https) connection.';
    }

    const name = thrown instanceof DOMException ? thrown.name : '';

    switch (name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Camera access was blocked. Allow the camera for this site in the browser settings, then try again.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'No camera was found on this device.';
        case 'NotReadableError':
        case 'AbortError':
            return 'The camera is busy. Close any other app or tab using it, then try again.';
        default:
            return thrown instanceof Error && thrown.message !== ''
                ? thrown.message
                : 'The scanner could not be started.';
    }
}

/**
 * A short beep and buzz so a read is noticed without looking at the screen.
 * Phones that will not play sound or vibrate just skip it.
 */
function signalHit(audio: AudioContext | null): void {
    navigator.vibrate?.(60);

    if (audio === null) {
        return;
    }

    try {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 1800;
        gain.gain.value = 0.08;
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.08);
    } catch {
        // Sound is a nicety; scanning carries on without it.
    }
}

export type ScannerStatus = 'idle' | 'starting' | 'running' | 'error';

/**
 * The outline of the code just read, in the video's own pixels.
 */
export type ScanHighlight = {
    points: { x: number; y: number }[];
    width: number;
    height: number;
};

type Options = {
    onScan: (barcode: string) => void;
    autoStart?: boolean;
};

/**
 * Drive a camera barcode scanner on the video element given the returned
 * ref (render it with ScannerViewfinder).
 *
 * Nothing starts until `start()` is called, or the component mounts when
 * `autoStart` is set, so the camera and the reading engine are only fetched
 * once someone actually opens the scanner.
 */
export function useBarcodeScanner({ onScan, autoStart = false }: Options) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [status, setStatus] = useState<ScannerStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [active, setActive] = useState(autoStart);
    const [highlight, setHighlight] = useState<ScanHighlight | null>(null);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const trackRef = useRef<MediaStreamTrack | null>(null);

    /**
     * Held in a ref so a new onScan never re-runs the effect and restarts
     * the camera mid-scan.
     */
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        if (!active) {
            return;
        }

        let disposed = false;
        let stream: MediaStream | null = null;
        let timer: number | null = null;
        let highlightTimer: number | null = null;
        let audio: AudioContext | null = null;
        const lastReported = new Map<string, number>();

        /**
         * Switch the camera off and let everything go. Safe to call more than
         * once, and from a start that finds it was stopped part way through.
         */
        const tearDown = () => {
            if (timer !== null) {
                window.clearTimeout(timer);
            }

            if (highlightTimer !== null) {
                window.clearTimeout(highlightTimer);
            }

            stream?.getTracks().forEach((track) => track.stop());
            stream = null;
            trackRef.current = null;

            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            void audio?.close().catch(() => {});
            audio = null;
        };

        const report = (barcode: DetectedBarcode, video: HTMLVideoElement) => {
            const code = canonicalBarcode(barcode.format, barcode.rawValue);
            const now = Date.now();
            const last = lastReported.get(code) ?? 0;

            if (now - last < DUPLICATE_FILTER_MS) {
                return;
            }

            lastReported.set(code, now);
            signalHit(audio);

            setHighlight({
                points: barcode.cornerPoints.map(({ x, y }) => ({ x, y })),
                width: video.videoWidth,
                height: video.videoHeight,
            });

            if (highlightTimer !== null) {
                window.clearTimeout(highlightTimer);
            }

            highlightTimer = window.setTimeout(
                () => setHighlight(null),
                HIGHLIGHT_MS,
            );

            onScanRef.current(code);
        };

        const scanLoop = async (detector: Detector) => {
            const video = videoRef.current;

            if (disposed || video === null) {
                return;
            }

            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                try {
                    const found = await detector.detect(video);

                    if (disposed) {
                        return;
                    }

                    found
                        .filter((barcode) => barcode.rawValue !== '')
                        .forEach((barcode) => report(barcode, video));
                } catch {
                    // A frame that cannot be read is skipped; the next one is tried.
                }
            }

            if (!disposed) {
                timer = window.setTimeout(
                    () => void scanLoop(detector),
                    SCAN_INTERVAL_MS,
                );
            }
        };

        const start = async () => {
            setStatus('starting');
            setError(null);

            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('insecure');
                }

                const [detector, startedStream] = await Promise.all([
                    createDetector(),
                    navigator.mediaDevices.getUserMedia({
                        audio: false,
                        video: {
                            facingMode: { ideal: 'environment' },
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                        },
                    }),
                ]);
                stream = startedStream;

                if (disposed) {
                    tearDown();

                    return;
                }

                const video = videoRef.current;

                if (video === null) {
                    tearDown();

                    return;
                }

                video.srcObject = startedStream;
                await video.play();

                if (disposed) {
                    tearDown();

                    return;
                }

                const [track] = startedStream.getVideoTracks();
                trackRef.current = track ?? null;
                const capabilities = (track?.getCapabilities?.() ??
                    {}) as MediaTrackCapabilities & { torch?: boolean };
                setTorchAvailable(capabilities.torch === true);
                setTorchOn(false);

                try {
                    audio = new AudioContext();
                } catch {
                    audio = null;
                }

                setStatus('running');
                void scanLoop(detector);
            } catch (thrown) {
                tearDown();

                if (disposed) {
                    return;
                }

                setStatus('error');
                setError(describeCameraError(thrown));
            }
        };

        void start();

        return () => {
            disposed = true;
            tearDown();
            setHighlight(null);
            setTorchAvailable(false);
            setTorchOn(false);
        };
    }, [active]);

    /**
     * Light up the phone's torch for dark engine bays and dim shelves, on
     * the cameras that have one.
     */
    const toggleTorch = () => {
        const track = trackRef.current;

        if (track === null) {
            return;
        }

        const next = !torchOn;

        track
            .applyConstraints({
                advanced: [{ torch: next } as MediaTrackConstraintSet],
            })
            .then(() => setTorchOn(next))
            .catch(() => setTorchAvailable(false));
    };

    return {
        videoRef,
        status,
        error,
        active,
        highlight,
        torch: { available: torchAvailable, on: torchOn, toggle: toggleTorch },
        start: () => setActive(true),
        stop: () => {
            setActive(false);
            setStatus('idle');
        },
    };
}

export type BarcodeScanner = ReturnType<typeof useBarcodeScanner>;
