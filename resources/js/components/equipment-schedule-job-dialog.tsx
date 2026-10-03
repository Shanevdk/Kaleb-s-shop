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
import { Textarea } from '@/components/ui/textarea';
import { store } from '@/routes/equipment-schedule/jobs';
import type { SelectOption } from '@/types';

/**
 * Put maintenance on the equipment schedule. It goes into the equipment
 * service log as planned work.
 */
export default function EquipmentScheduleJobDialog({
    trigger,
    equipment,
    types,
    defaultDate,
}: {
    trigger: ReactNode;
    equipment: SelectOption[];
    types: SelectOption[];
    defaultDate: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Add maintenance to the schedule</DialogTitle>
                <DialogDescription>
                    It shows up in the equipment service log as planned work.
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
                                <Label htmlFor="job_equipment_id">
                                    Equipment
                                </Label>
                                <Select name="equipment_id" required>
                                    <SelectTrigger
                                        id="job_equipment_id"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Pick a piece of equipment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {equipment.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.equipment_id} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_title">
                                    What needs doing
                                </Label>
                                <Input
                                    id="job_title"
                                    name="title"
                                    placeholder="Replace compressor air filter"
                                    maxLength={120}
                                    required
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
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
                                    <Label htmlFor="job_performed_on">
                                        Day
                                    </Label>
                                    <Input
                                        id="job_performed_on"
                                        name="performed_on"
                                        type="date"
                                        defaultValue={defaultDate}
                                        required
                                    />
                                    <InputError message={errors.performed_on} />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="job_description">Notes</Label>
                                <Textarea
                                    id="job_description"
                                    name="description"
                                    placeholder="Anything whoever does it should know."
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
