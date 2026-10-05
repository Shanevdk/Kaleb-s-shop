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
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * Move something on a schedule to another day. A booked check has to stay
 * inside the window (the month or year) it covers. When the move would
 * put something on a day the shop is closed, it asks before doing so.
 */
export default function RescheduleDialog({
    id,
    title,
    subject,
    form,
    field,
    defaultDate,
    fields = {},
    between = null,
    trigger,
}: {
    id: string;
    title: string;
    subject: string | undefined;
    form: RouteFormDefinition<'post'>;
    field: string;
    defaultDate: string;
    /** Anything else to send along with the new day. */
    fields?: Record<string, string>;
    between?: { from: string; to: string } | null;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [closedDays, setClosedDays] = useState<string | null>(null);

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                setClosedDays(null);
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Move {title.toLowerCase()}</DialogTitle>
                <DialogDescription>
                    {subject}
                    {between &&
                        ` · any day from ${formatDate(between.from)} to ${formatDate(between.to)}`}
                </DialogDescription>

                <Form
                    {...form}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    onError={(errors) =>
                        setClosedDays(errors.closed_days ?? null)
                    }
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            {Object.entries(fields).map(([name, value]) => (
                                <input
                                    key={name}
                                    type="hidden"
                                    name={name}
                                    value={value}
                                />
                            ))}
                            {closedDays !== null && (
                                <input
                                    type="hidden"
                                    name="on_closed_days"
                                    value="1"
                                />
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor={`move_${id}`}>New day</Label>
                                <Input
                                    id={`move_${id}`}
                                    name={field}
                                    type="date"
                                    defaultValue={defaultDate}
                                    min={between?.from}
                                    max={between?.to}
                                    onChange={() => setClosedDays(null)}
                                    required
                                />
                                <InputError message={errors[field]} />
                                <InputError message={closedDays ?? undefined} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {closedDays === null
                                        ? 'Move'
                                        : 'Move anyway'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
