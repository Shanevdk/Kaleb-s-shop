import { useSyncExternalStore } from 'react';

/**
 * What the screen saver can show. Everything picked is on screen at once,
 * with the pictures filling the background behind the rest.
 */
export type ScreenSaverPanel = 'clock' | 'pictures' | 'schedule' | 'checklists';

export const screenSaverPanels: {
    value: ScreenSaverPanel;
    label: string;
    description: string;
}[] = [
    {
        value: 'clock',
        label: 'Clock',
        description: 'A large digital clock, and the date.',
    },
    {
        value: 'pictures',
        label: 'Pictures',
        description: 'Fill the background, changing every few seconds.',
    },
    {
        value: 'schedule',
        label: "Today's jobs",
        description: "What's booked in for today, from the schedule.",
    },
    {
        value: 'checklists',
        label: 'Open checklists',
        description: 'Checklists started but not yet signed off.',
    },
];

export type ScreenSaverSettings = {
    enabled: boolean;
    /** Minutes without a tap, click or key press before it drops down. */
    minutes: number;
    clock: '12h' | '24h';
    showSeconds: boolean;
    showDate: boolean;
    /** What is on the screen saver. */
    panels: ScreenSaverPanel[];
    /** Seconds each background picture stays up. */
    secondsPerPanel: number;
};

export const defaultScreenSaverSettings: ScreenSaverSettings = {
    enabled: false,
    minutes: 2,
    clock: '12h',
    showSeconds: true,
    showDate: true,
    panels: ['clock'],
    secondsPerPanel: 12,
};

const storageKey = 'screen-saver';
const previewEvent = 'screen-saver:preview';
const listeners = new Set<() => void>();
const knownPanels = screenSaverPanels.map((panel) => panel.value);

let cached: ScreenSaverSettings | null = null;

/**
 * Read the settings saved on this device, falling back to the defaults when
 * storage is empty, blocked or holds something unreadable.
 */
const read = (): ScreenSaverSettings => {
    if (cached !== null) {
        return cached;
    }

    let stored: Partial<ScreenSaverSettings> = {};

    try {
        stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {};
    } catch {
        stored = {};
    }

    cached = { ...defaultScreenSaverSettings, ...stored };

    const panels = Array.isArray(cached.panels)
        ? cached.panels.filter((panel) => knownPanels.includes(panel))
        : [];
    cached.panels =
        panels.length > 0 ? panels : defaultScreenSaverSettings.panels;

    return cached;
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

/**
 * Save a change to the screen saver settings for this device.
 */
export function updateScreenSaver(changes: Partial<ScreenSaverSettings>): void {
    cached = { ...read(), ...changes };

    try {
        localStorage.setItem(storageKey, JSON.stringify(cached));
    } catch {
        // Storage can be blocked; the change still holds until a reload.
    }

    listeners.forEach((listener) => listener());
}

/**
 * Drop the screen saver down straight away, to see how it looks.
 */
export function previewScreenSaver(): void {
    window.dispatchEvent(new Event(previewEvent));
}

export const screenSaverPreviewEvent = previewEvent;

export function useScreenSaver(): ScreenSaverSettings {
    return useSyncExternalStore(
        subscribe,
        read,
        () => defaultScreenSaverSettings,
    );
}
