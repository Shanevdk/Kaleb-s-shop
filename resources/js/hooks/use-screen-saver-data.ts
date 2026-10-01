import { useEffect, useState } from 'react';
import { data as screenSaverData } from '@/routes/screen-saver';

export type ScreenSaverJob = {
    id: string;
    title: string;
    status: string;
    vehicle: string | null;
};

export type ScreenSaverChecklist = {
    id: string;
    title: string;
    vehicle: string | null;
    itemsCount: number;
    checkedCount: number;
    flaggedCount: number;
};

export type ScreenSaverData = {
    date: string;
    jobsToday: ScreenSaverJob[];
    checklistsInProgress: ScreenSaverChecklist[];
};

const refreshIntervalMs = 5 * 60_000;

/**
 * Today's jobs and any open checklist, for the schedule and checklist
 * panels. Only polled while one of those panels is actually in use.
 */
export function useScreenSaverData(enabled: boolean): ScreenSaverData | null {
    const [data, setData] = useState<ScreenSaverData | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;

        const load = () => {
            fetch(screenSaverData.url(), {
                headers: { Accept: 'application/json' },
            })
                .then((response) => (response.ok ? response.json() : null))
                .then((payload: ScreenSaverData | null) => {
                    if (!cancelled && payload) {
                        setData(payload);
                    }
                })
                .catch(() => undefined);
        };

        load();
        const timer = window.setInterval(load, refreshIntervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [enabled]);

    return data;
}
