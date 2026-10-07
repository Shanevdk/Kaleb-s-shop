import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Whether a visit to another page is taking long enough to be worth a
 * skeleton. Quick visits (prefetched pages, mostly) never show one, and
 * reloading the same page with new filters keeps it on screen.
 */
export function usePageLoading(delay = 150): boolean {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let current: unknown = null;

        const offStart = router.on('start', (event) => {
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

            current = visit;
            clearTimeout(timer);
            timer = setTimeout(() => setIsLoading(true), delay);
        });

        const offFinish = router.on('finish', (event) => {
            if (event.detail.visit !== current) {
                return;
            }

            current = null;
            clearTimeout(timer);
            setIsLoading(false);
        });

        return () => {
            offStart();
            offFinish();
            clearTimeout(timer);
        };
    }, [delay]);

    return isLoading;
}
