import type * as ScanditBarcode from '@scandit/web-datacapture-barcode';
import type * as ScanditCore from '@scandit/web-datacapture-core';
import { useEffect, useRef, useState } from 'react';

/**
 * Load the Scandit SDK the first time the camera is opened. It is a few
 * hundred kilobytes of script, so pages that offer scanning stay quick to
 * load for everyone who never presses the button.
 */
function loadScandit() {
    return Promise.all([
        import('@scandit/web-datacapture-core'),
        import('@scandit/web-datacapture-barcode'),
    ]);
}

/**
 * The symbologies worth reading in a workshop: retail codes on boxed parts,
 * Code 128/39 on supplier labels, and QR / Data Matrix on newer packaging.
 */
function workshopSymbologies({
    Symbology,
}: typeof ScanditBarcode): ScanditBarcode.Symbology[] {
    return [
        Symbology.EAN13UPCA,
        Symbology.EAN8,
        Symbology.UPCE,
        Symbology.Code128,
        Symbology.Code39,
        Symbology.Code93,
        Symbology.InterleavedTwoOfFive,
        Symbology.QR,
        Symbology.DataMatrix,
    ];
}

export type ScannerStatus = 'idle' | 'starting' | 'running' | 'error';

type Options = {
    licenseKey: string;
    libraryLocation: string;
    onScan: (barcode: string) => void;
    autoStart?: boolean;
};

/**
 * Drive the Scandit camera scanner attached to the returned element ref.
 *
 * Nothing starts until `start()` is called, or the component mounts when
 * `autoStart` is set, so the WASM engine is only fetched once someone
 * actually opens the camera.
 */
export function useBarcodeScanner({
    licenseKey,
    libraryLocation,
    onScan,
    autoStart = false,
}: Options) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<ScannerStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [active, setActive] = useState(autoStart);

    /**
     * Held in a ref so restarting the camera never re-runs the effect and
     * tears the whole capture context down mid-scan.
     */
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        if (!active || licenseKey === '') {
            return;
        }

        let disposed = false;
        let context: ScanditCore.DataCaptureContext | null = null;
        let camera: ScanditCore.Camera | null = null;
        let view: ScanditCore.DataCaptureView | null = null;
        let core: typeof ScanditCore | null = null;

        /**
         * Switch the camera off and free the engine. The cleanup calls it, and
         * so does `start()` whenever it finds it was stopped part way through:
         * anything it set up after the cleanup ran would otherwise be left on.
         * Each piece is let go of once, so calling it again is harmless.
         */
        const tearDown = () => {
            const [openView, openCamera, openContext] = [view, camera, context];
            view = null;
            camera = null;
            context = null;

            openView?.detachFromElement();
            if (openCamera && core) {
                void openCamera
                    .switchToDesiredState(core.FrameSourceState.Off)
                    .catch(() => {});
            }
            void openContext?.dispose();
        };

        const start = async () => {
            setStatus('starting');
            setError(null);

            try {
                const [loadedCore, barcode] = await loadScandit();
                core = loadedCore;

                if (disposed) {
                    return;
                }

                const {
                    Camera,
                    CameraPosition,
                    DataCaptureContext,
                    DataCaptureView,
                    FrameSourceState,
                } = loadedCore;
                const {
                    BarcodeCapture,
                    BarcodeCaptureOverlay,
                    BarcodeCaptureSettings,
                    barcodeCaptureLoader,
                } = barcode;

                const startedContext = await DataCaptureContext.forLicenseKey(
                    licenseKey,
                    {
                        libraryLocation,
                        moduleLoaders: [barcodeCaptureLoader()],
                    },
                );
                context = startedContext;

                if (disposed) {
                    tearDown();

                    return;
                }

                const startedCamera = Camera.pickBestGuessForPosition(
                    CameraPosition.WorldFacing,
                );
                camera = startedCamera;
                await startedContext.setFrameSource(startedCamera);

                const settings = new BarcodeCaptureSettings();
                settings.enableSymbologies(workshopSymbologies(barcode));
                settings.codeDuplicateFilter = 1500;

                const capture = await BarcodeCapture.forContext(
                    startedContext,
                    settings,
                );

                capture.addListener({
                    didScan: (_capture, session) => {
                        const data = session.newlyRecognizedBarcode?.data;

                        if (data) {
                            onScanRef.current(data);
                        }
                    },
                });

                const startedView =
                    await DataCaptureView.forContext(startedContext);
                view = startedView;

                if (disposed) {
                    tearDown();

                    return;
                }

                if (hostRef.current === null) {
                    return;
                }

                startedView.connectToElement(hostRef.current);
                await BarcodeCaptureOverlay.withBarcodeCaptureForView(
                    capture,
                    startedView,
                );

                if (disposed) {
                    tearDown();

                    return;
                }

                await startedCamera.switchToDesiredState(FrameSourceState.On);

                // Closed while the camera was coming on: turn it back off.
                if (disposed) {
                    tearDown();

                    return;
                }

                await capture.setEnabled(true);

                if (disposed) {
                    tearDown();

                    return;
                }

                setStatus('running');
            } catch (thrown) {
                if (disposed) {
                    tearDown();

                    return;
                }

                setStatus('error');
                setError(
                    thrown instanceof Error
                        ? thrown.message
                        : 'The scanner could not be started.',
                );
            }
        };

        void start();

        return () => {
            disposed = true;
            tearDown();
        };
    }, [active, licenseKey, libraryLocation]);

    return {
        hostRef,
        status,
        error,
        active,
        start: () => setActive(true),
        stop: () => {
            setActive(false);
            setStatus('idle');
        },
    };
}
