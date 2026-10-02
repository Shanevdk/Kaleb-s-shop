import { useSyncExternalStore } from 'react';

/**
 * Which set of nav links the sidebar shows. Picked from the brand switcher
 * under "Kaleb's Shop", and remembered on this device so it holds across
 * page loads until it is switched again.
 */
export type Workspace = 'mechanics' | 'equipment';

const storageKey = 'workspace';
const listeners = new Set<() => void>();

let cached: Workspace | null = null;

const isWorkspace = (value: unknown): value is Workspace =>
    value === 'mechanics' || value === 'equipment';

const read = (): Workspace => {
    if (cached !== null) {
        return cached;
    }

    let stored: unknown = null;

    try {
        stored = localStorage.getItem(storageKey);
    } catch {
        stored = null;
    }

    cached = isWorkspace(stored) ? stored : 'mechanics';

    return cached;
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

/**
 * Switch which nav links the sidebar shows on this device.
 */
export function setWorkspace(workspace: Workspace): void {
    cached = workspace;

    try {
        localStorage.setItem(storageKey, workspace);
    } catch {
        // Storage can be blocked; the change still holds until a reload.
    }

    listeners.forEach((listener) => listener());
}

export function useWorkspace(): Workspace {
    return useSyncExternalStore(subscribe, read, () => 'mechanics');
}
