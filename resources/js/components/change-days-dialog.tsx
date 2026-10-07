import { Form } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import DaysField from '@/components/days-field';
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
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * Change the days a job on a schedule is booked on: move it, spread it over
 * more days, or take days off it. Before booking it on a day the shop is
 * closed that it was not already on, it asks.
 */
export default function ChangeDaysDialog({
    id,
    title,
    subject,
    form,
    days,
    trigger,
}: {
    id: string;
    title: string;
    subject: string | undefined;
    form: RouteFormDefinition<'post'>;
    days: string[];
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
                <DialogTitle>
                    Change the days for {title.toLowerCase()}
                </DialogTitle>
                <DialogDescription>{subject}</DialogDescription>

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
                            {closedDays !== null && (
                                <input
                                    type="hidden"
                                    name="on_closed_days"
                                    value="1"
                                />
                            )}

                            <div
                                onChange={() => setClosedDays(null)}
                                onClick={() => setClosedDays(null)}
                            >
                                <DaysField
                                    id={`days_${id}`}
                                    defaultDays={days}
                                    errors={errors}
                                />
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
                                        ? 'Save days'
                                        : 'Save anyway'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
