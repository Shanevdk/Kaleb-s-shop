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
 * inside the window (the month or year) it covers.
 */
export default function RescheduleDialog({
    id,
    title,
    subject,
    form,
    field,
    defaultDate,
    between = null,
    trigger,
}: {
    id: string;
    title: string;
    subject: string | undefined;
    form: RouteFormDefinition<'post'>;
    field: string;
    defaultDate: string;
    between?: { from: string; to: string } | null;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`move_${id}`}>New day</Label>
                                <Input
                                    id={`move_${id}`}
                                    name={field}
                                    type="date"
                                    defaultValue={defaultDate}
                                    min={between?.from}
                                    max={between?.to}
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
