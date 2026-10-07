import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Whether a visit to another page is taking long enough to be worth a
 * skeleton. Quick visits (prefetched pages, mostly) never show one, and
 * reloading the same page with new filters keeps it on screen.
 *
 * The wait is timed from `before`, not `start`: a visit that picks up a
 * prefetch still on its way never sends a request of its own, so it never
 * fires `start` or `finish`, only `navigate` once the page arrives.
 */
export function usePageLoading(delay = 150): boolean {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let pending: { id: string; pathname: string } | null = null;

        const stop = () => {
            pending = null;
            clearTimeout(timer);
            setIsLoading(false);
        };

        const offBefore = router.on('before', (event) => {
            const { visit } = event.detail;

            if (
                visit.method !== 'get' ||
                visit.prefetch ||
                visit.async ||
                visit.only.length > 0 ||
                visit.except.length > 0 ||
                visit.url.pathname === window.location.pathname
            ) {
                return;
            }

            pending = { id: visit.id, pathname: visit.url.pathname };
            clearTimeout(timer);
            timer = setTimeout(() => setIsLoading(true), delay);
        });

        const offNavigate = router.on('navigate', (event) => {
            const { pathname } = new URL(
                event.detail.page.url,
                window.location.origin,
            );

            if (pending?.pathname === pathname) {
                stop();
            }
        });

        const offFinish = router.on('finish', (event) => {
            if (event.detail.visit.id === pending?.id) {
                stop();
            }
        });

        const offNetworkError = router.on('networkError', () => {
            if (pending) {
                stop();
            }
        });

        return () => {
            offBefore();
            offNavigate();
            offFinish();
            offNetworkError();
            clearTimeout(timer);
        };
    }, [delay]);

    return isLoading;
}
