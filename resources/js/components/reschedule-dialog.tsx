import { Form } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { update as updateCheck } from '@/routes/schedule/checks';
import { update as updateJob } from '@/routes/schedule/jobs';
import type { ScheduleEntry } from '@/types';

/**
 * Move a booked check or a job to another day. A check has to stay inside
 * the month (or year) it covers.
 */
export default function RescheduleDialog({
    entry,
    trigger,
}: {
    entry: ScheduleEntry;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const isJob = entry.kind === 'job';
    const field = isJob ? 'performed_on' : 'due_on';
    const form = isJob ? updateJob.form(entry.id) : updateCheck.form(entry.id);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Move {entry.title.toLowerCase()}</DialogTitle>
                <DialogDescription>
                    {entry.vehicle?.display_name}
                    {entry.window &&
                        ` · any day from ${formatDate(entry.window.from)} to ${formatDate(entry.window.to)}`}
                </DialogDescription>

                <Form
                    {...form}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`move_${entry.id}`}>
                                    New day
                                </Label>
                                <Input
                                    id={`move_${entry.id}`}
                                    name={field}
                                    type="date"
                                    defaultValue={entry.due_on}
                                    min={entry.window?.from}
                                    max={entry.window?.to}
                                    required
                                />
                                <InputError message={errors[field]} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Move
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
