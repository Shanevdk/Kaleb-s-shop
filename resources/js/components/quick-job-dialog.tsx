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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SelectOption } from '@/types';
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * What the picker holds when the job has nothing picked yet; a select item
 * cannot have an empty value.
 */
const NOTHING_PICKED = 'none';

/**
 * What the job is for: a vehicle on Kaleb's Shop's queue, a machine on an
 * equipment division's. With `unpickedLabel` set it may be left for later.
 */
export type QuickJobSubject = {
    name: string;
    label: string;
    options: SelectOption[];
    placeholder: string;
    unpickedLabel?: string;
};

/**
 * Drop a job straight on a queue with just what it is for and what needs
 * doing. It lands as planned work today, the same as one logged in full,
 * so the rest of the detail can be filled in later from the service log.
 */
export default function QuickJobDialog({
    trigger,
    form,
    subject,
    titlePlaceholder,
}: {
    trigger: ReactNode;
    form: RouteFormDefinition<'post'>;
    subject: QuickJobSubject;
    titlePlaceholder: string;
}) {
    const [open, setOpen] = useState(false);
    const canLeaveUnpicked = subject.unpickedLabel !== undefined;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Quick add a job</DialogTitle>
                <DialogDescription>
                    Just the basics — it goes straight on the queue as planned
                    for today. Add the rest later from the service log.
                </DialogDescription>

                <Form
                    {...form}
                    options={{ preserveScroll: true }}
                    transform={(data) => ({
                        ...data,
                        [subject.name]:
                            data[subject.name] === NOTHING_PICKED
                                ? null
                                : data[subject.name],
                    })}
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="quick_job_subject">
                                    {subject.label}
                                </Label>
                                <Select
                                    name={subject.name}
                                    defaultValue={
                                        canLeaveUnpicked
                                            ? NOTHING_PICKED
                                            : undefined
                                    }
                                    required={!canLeaveUnpicked}
                                >
                                    <SelectTrigger
                                        id="quick_job_subject"
                                        className="w-full"
                                    >
                                        <SelectValue
                                            placeholder={subject.placeholder}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {canLeaveUnpicked && (
                                            <SelectItem value={NOTHING_PICKED}>
                                                {subject.unpickedLabel}
                                            </SelectItem>
                                        )}
                                        {subject.options.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors[subject.name]} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="quick_job_title">
                                    What needs doing
                                </Label>
                                <Input
                                    id="quick_job_title"
                                    name="title"
                                    placeholder={titlePlaceholder}
                                    maxLength={120}
                                    required
                                    autoFocus
                                />
                                <InputError message={errors.title} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Add to queue
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
