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
import { store } from '@/routes/job-queue';
import type { SelectOption } from '@/types';

/**
 * What the vehicle picker holds when the job has no vehicle yet; a select
 * item cannot have an empty value.
 */
const NO_VEHICLE = 'none';

/**
 * Drop a job straight on the queue with just what needs doing, and the
 * vehicle if it is known. It lands as planned work today, the same as one
 * logged in full, so the rest of the detail can be filled in later from
 * the service log.
 */
export default function QuickJobDialog({
    trigger,
    vehicles,
}: {
    trigger: ReactNode;
    vehicles: SelectOption[];
}) {
    const [open, setOpen] = useState(false);

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
                    {...store.form()}
                    options={{ preserveScroll: true }}
                    transform={(data) => ({
                        ...data,
                        vehicle_id:
                            data.vehicle_id === NO_VEHICLE
                                ? null
                                : data.vehicle_id,
                    })}
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="quick_job_vehicle_id">
                                    Vehicle
                                </Label>
                                <Select
                                    name="vehicle_id"
                                    defaultValue={NO_VEHICLE}
                                >
                                    <SelectTrigger
                                        id="quick_job_vehicle_id"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_VEHICLE}>
                                            No vehicle yet
                                        </SelectItem>
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
                                <Label htmlFor="quick_job_title">
                                    What needs doing
                                </Label>
                                <Input
                                    id="quick_job_title"
                                    name="title"
                                    placeholder="Replace front brake pads"
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
