import { Form } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import DaysField from '@/components/days-field';
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
 * more days, or take days off it.
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <DaysField
                                id={`days_${id}`}
                                defaultDays={days}
                                errors={errors}
                            />

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Save days
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
