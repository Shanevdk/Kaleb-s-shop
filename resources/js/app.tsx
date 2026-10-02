import { createInertiaApp, router } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

/**
 * The installed app's manifest start_url is /dashboard, so when the OS
 * relaunches it from a backgrounded/killed state it always opens there
 * instead of resuming the page that was open. Remember the last page and
 * bounce back to it when that happens.
 */
const LAST_PATH_STORAGE_KEY = 'vdk:last-path';
const START_URL = '/dashboard';
const UNRESUMABLE_PATH_PREFIXES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/confirm-password',
    '/two-factor-challenge',
    '/email/verify',
    '/phone-scanner',
    '/work-orders',
];

function isResumablePath(path: string): boolean {
    return (
        path !== '/' &&
        !UNRESUMABLE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
    );
}

function isStandaloneDisplay(): boolean {
    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
            true
    );
}

let redirectingToLastPath = false;

if (isStandaloneDisplay() && window.location.pathname === START_URL) {
    try {
        const lastPath = localStorage.getItem(LAST_PATH_STORAGE_KEY);

        if (
            lastPath &&
            lastPath !== window.location.pathname + window.location.search &&
            isResumablePath(lastPath)
        ) {
            redirectingToLastPath = true;
            window.location.replace(lastPath);
        }
    } catch {
        // localStorage unavailable (private browsing, etc.) — fall through to the normal start_url.
    }
}

router.on('navigate', (event) => {
    const path = event.detail.page.url;

    if (isResumablePath(path)) {
        try {
            localStorage.setItem(LAST_PATH_STORAGE_KEY, path);
        } catch {
            // Ignore — resuming on relaunch is a nice-to-have, not critical.
        }
    }
});

if (!redirectingToLastPath) {
    void createInertiaApp({
        title: (title) => (title ? `${title} - ${appName}` : appName),
        layout: (name) => {
            switch (true) {
                case name === 'welcome' ||
                    name === 'phone-scanner' ||
                    name === 'work-order':
                    return null;
                case name.startsWith('auth/'):
                    return AuthLayout;
                case name.startsWith('settings/'):
                    return [AppLayout, SettingsLayout];
                default:
                    return AppLayout;
            }
        },
        strictMode: true,
        withApp(app) {
            return (
                <TooltipProvider delayDuration={0}>
                    {app}
                    <Toaster />
                </TooltipProvider>
            );
        },
        progress: {
            color: '#4B5563',
        },
    });

    // This will set light / dark mode on load...
    initializeTheme();
}
