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
import { store } from '@/routes/schedule/closed-days';

/**
 * Mark a day the shop is shut. The checks the planner had booked on it move
 * to another day; anything put there by hand stays put.
 */
export default function MarkClosedDialog({
    date,
    label,
    trigger,
}: {
    date: string;
    label: string;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Close the shop on {label}?</DialogTitle>
                <DialogDescription>
                    Nothing gets booked in automatically on a closed day, and
                    the checks already booked there move to another day.
                </DialogDescription>

                <Form
                    {...store.form()}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <input type="hidden" name="date" value={date} />

                            <div className="grid gap-2">
                                <Label htmlFor={`closed_reason_${date}`}>
                                    Why
                                </Label>
                                <Input
                                    id={`closed_reason_${date}`}
                                    name="reason"
                                    defaultValue="Shop closed"
                                    maxLength={80}
                                    required
                                />
                                <InputError
                                    message={errors.reason ?? errors.date}
                                />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Mark as closed
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
