import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { showFailure } from '@/lib/optimistic';

type CalendarJob = { id: string; kind: string; date: string; days?: string[] };

const dayLength = 24 * 60 * 60 * 1000;

/**
 * Move a date, as YYYY-MM-DD, by a number of days.
 */
const shiftDate = (date: string, days: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * dayLength)
        .toISOString()
        .slice(0, 10);

/**
 * Move a job on a schedule by dragging one of its days to another date.
 * A job over several days moves as a whole, and shows in its new place
 * straight away; if the move is turned down it goes back. If the move
 * would put its other days on days the shop is closed, it asks before
 * doing so. The page's calendar entries have to be called entries.
 */
export function moveJob(
    url: string,
    job: { id: string; date: string },
    date: string,
    onClosedDays = false,
): void {
    const moved = Math.round(
        (Date.parse(`${date}T00:00:00Z`) -
            Date.parse(`${job.date}T00:00:00Z`)) /
            dayLength,
    );

    router
        .optimistic<{ entries: CalendarJob[] }>((props) => ({
            entries: props.entries.map((entry) =>
                entry.kind === 'job' && entry.id === job.id
                    ? {
                          ...entry,
                          date: shiftDate(entry.date, moved),
                          days: entry.days?.map((day) => shiftDate(day, moved)),
                      }
                    : entry,
            ),
        }))
        .patch(
            url,
            { performed_on: date, day: job.date, on_closed_days: onClosedDays },
            {
                preserveScroll: true,
                showProgress: false,
                onError: (errors) =>
                    errors.closed_days
                        ? toast.warning(errors.closed_days, {
                              action: {
                                  label: 'Move anyway',
                                  onClick: () => moveJob(url, job, date, true),
                              },
                          })
                        : showFailure(errors, 'That could not be moved.'),
            },
        );
}
