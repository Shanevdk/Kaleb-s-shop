import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

/**
 * Show the toasts the server flashes, and say so when a request fails
 * outright: the server could not be reached, or it answered with an error
 * that is not a page of its own (an error page the app renders is left to
 * show itself).
 */
export function useFlashToast(): void {
    useEffect(() => {
        const offFlash = router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.message);
        });

        const offNetworkError = router.on('networkError', (event) => {
            event.preventDefault();
            toast.error(
                'The server could not be reached. Check the connection and try again.',
            );
        });

        const offHttpException = router.on('httpException', (event) => {
            const { response } = event.detail;

            if (response.headers?.['x-inertia']) {
                return;
            }

            toast.error(
                response.status === 419
                    ? 'This page has expired. Reload it and try again.'
                    : `Something went wrong (error ${response.status}). Try again.`,
            );

            // Keep the full error screen while developing; in use, the toast
            // is enough.
            if (import.meta.env.PROD) {
                event.preventDefault();
            }
        });

        return () => {
            offFlash();
            offNetworkError();
            offHttpException();
        };
    }, []);
}
