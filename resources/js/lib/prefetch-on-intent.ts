import { router } from '@inertiajs/react';

/**
 * How long a page fetched ahead of a click is good for. Anything that
 * changes data throws the lot away (see below), so this only covers changes
 * someone else makes in the meantime.
 */
const CACHE_FOR = '30s';

/**
 * How long the mouse has to rest on a link before its page is fetched, so
 * sweeping across the sidebar doesn't fetch every page on the way.
 */
const HOVER_DELAY = 60;

/**
 * The app path a link leads to, if it is one worth fetching ahead: a plain
 * same-tab link to another page of the app. New tabs, downloads, files and
 * links marked `data-prefetch="false"` are left alone.
 */
function prefetchablePath(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) {
        return null;
    }

    const link = target.closest('a[href]');

    if (
        !(link instanceof HTMLAnchorElement) ||
        (link.target !== '' && link.target !== '_self') ||
        link.hasAttribute('download') ||
        link.dataset.prefetch === 'false'
    ) {
        return null;
    }

    const url = new URL(link.href);

    if (
        url.origin !== window.location.origin ||
        /\.\w+$/.test(url.pathname) ||
        (url.pathname === window.location.pathname &&
            url.search === window.location.search)
    ) {
        return null;
    }

    return url.pathname + url.search;
}

function prefetch(path: string): void {
    router.prefetch(path, { method: 'get' }, { cacheFor: CACHE_FOR });
}

/**
 * Start fetching a page as soon as someone shows they're about to open it,
 * so it is usually there by the time the click lands: after the mouse rests
 * on a link for a moment, or the instant a finger or button presses one
 * (a tap takes around 100ms to become a click).
 *
 * Every save, delete or toggle empties the cache, so a page fetched before
 * a change is never shown after it.
 */
export function prefetchOnIntent(): void {
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;

    document.addEventListener(
        'pointerover',
        (event) => {
            if (event.pointerType !== 'mouse') {
                return;
            }

            const path = prefetchablePath(event.target);

            clearTimeout(hoverTimer);

            if (path !== null) {
                hoverTimer = setTimeout(() => prefetch(path), HOVER_DELAY);
            }
        },
        { passive: true },
    );

    document.addEventListener(
        'pointerdown',
        (event) => {
            if (event.button !== 0) {
                return;
            }

            const path = prefetchablePath(event.target);

            if (path !== null) {
                clearTimeout(hoverTimer);
                prefetch(path);
            }
        },
        { passive: true },
    );

    router.on('finish', (event) => {
        if (event.detail.visit.method !== 'get') {
            router.flushAll();
        }
    });
}
