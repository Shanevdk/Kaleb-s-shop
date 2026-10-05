import { Form } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { store } from '@/routes/schedule/jobs';
import type { SelectOption } from '@/types';

/**
 * The day after the given one, as YYYY-MM-DD.
 */
const dayAfter = (date: string) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

/**
 * The day to add next: the one after the latest day picked so far, or the
 * day the dialog opened on when none has been picked yet.
 */
const nextDay = (days: string[], defaultDate: string) => {
    const picked = days.filter((day) => day !== '').sort();

    return picked.length > 0
        ? dayAfter(picked[picked.length - 1])
        : defaultDate;
};

/**
 * Put a job on the schedule for a vehicle, on one day or several. It goes
 * into the service log as planned work for the mechanics to pick up.
 */
export default function ScheduleJobDialog({
    trigger,
    vehicles,
    types,
    defaultDate,
}: {
    trigger: ReactNode;
    vehicles: SelectOption[];
    types: SelectOption[];
    defaultDate: string;
}) {
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState([defaultDate]);

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (isOpen) {
                    setDays([defaultDate]);
                }

                setOpen(isOpen);
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Add a job to the schedule</DialogTitle>
                <DialogDescription>
                    It shows up in the service log as planned work, and any
                    parts it needs go on the shopping list.
                </DialogDescription>

                <Form
                    {...store.form()}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="job_vehicle_id">Vehicle</Label>
                                <Select name="vehicle_id" required>
                                    <SelectTrigger
                                        id="job_vehicle_id"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Pick a vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.map((vehicle) => (
                                            <SelectItem
                                                key={vehicle.value}
                                                value={vehicle.value}
                                            >
                                                {vehicle.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.vehicle_id} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_title">
                                    What needs doing
                                </Label>
                                <Input
                                    id="job_title"
                                    name="title"
                                    placeholder="Replace front brake pads"
                                    maxLength={120}
                                    required
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_type">Type</Label>
                                <Select
                                    name="type"
                                    defaultValue={types[0]?.value}
                                    required
                                >
                                    <SelectTrigger
                                        id="job_type"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((type) => (
                                            <SelectItem
                                                key={type.value}
                                                value={type.value}
                                            >
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.type} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_day_0">
                                    {days.length > 1 ? 'Days' : 'Day'}
                                </Label>
                                {days.map((day, position) => (
                                    <div
                                        key={position}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            id={`job_day_${position}`}
                                            name="days[]"
                                            type="date"
                                            value={day}
                                            onChange={(event) =>
                                                setDays((current) =>
                                                    current.map(
                                                        (existing, index) =>
                                                            index === position
                                                                ? event.target
                                                                      .value
                                                                : existing,
                                                    ),
                                                )
                                            }
                                            aria-label={`Day ${position + 1}`}
                                            required
                                        />
                                        {days.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDays((current) =>
                                                        current.filter(
                                                            (_, index) =>
                                                                index !==
                                                                position,
                                                        ),
                                                    )
                                                }
                                                aria-label={`Remove day ${position + 1}`}
                                            >
                                                <X />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="justify-self-start"
                                    onClick={() =>
                                        setDays((current) => [
                                            ...current,
                                            nextDay(current, defaultDate),
                                        ])
                                    }
                                >
                                    <Plus />
                                    Add another day
                                </Button>
                                <InputError
                                    message={
                                        errors.days ??
                                        Object.entries(errors).find(([key]) =>
                                            key.startsWith('days.'),
                                        )?.[1]
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_description">Notes</Label>
                                <Textarea
                                    id="job_description"
                                    name="description"
                                    placeholder="Anything the mechanic should know."
                                />
                                <InputError message={errors.description} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Add to schedule
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
