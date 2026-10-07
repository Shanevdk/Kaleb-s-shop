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
import { todayString } from '@/lib/format';
import { store, update } from '@/routes/equipment-service-records';
import type { EquipmentServiceRecord, SelectOption } from '@/types';

/**
 * What the machine picker holds when the record has no machine yet; a
 * select item cannot have an empty value.
 */
const NO_MACHINE = 'none';

/**
 * Log a service record against a piece of equipment, or edit one. Given the
 * division's machines, editing can also pick the machine for a job that was
 * quick-added without one.
 */
export default function EquipmentServiceRecordDialog({
    trigger,
    types,
    statuses,
    equipment,
    ...target
}: {
    trigger: ReactNode;
    types: SelectOption[];
    statuses: SelectOption[];
    equipment?: SelectOption[];
} & (
    | { record: EquipmentServiceRecord; equipmentId?: never }
    | { record?: never; equipmentId: string }
)) {
    const [open, setOpen] = useState(false);
    const record = target.record;
    const action = target.record
        ? update.form(target.record.id)
        : store.form(target.equipmentId);
    const canPickMachine = record !== undefined && equipment !== undefined;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    {record ? 'Edit service record' : 'Log a service record'}
                </DialogTitle>
                <DialogDescription>
                    {record
                        ? 'Keep the work done on this equipment accurate.'
                        : 'Record what was done so the history builds up.'}
                </DialogDescription>

                <Form
                    {...action}
                    options={{ preserveScroll: true }}
                    transform={(data) =>
                        data.equipment_id === NO_MACHINE
                            ? { ...data, equipment_id: null }
                            : data
                    }
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            {canPickMachine && (
                                <div className="grid gap-2">
                                    <Label htmlFor="record_equipment_id">
                                        Equipment
                                    </Label>
                                    <Select
                                        name="equipment_id"
                                        defaultValue={
                                            record.equipment_id ?? NO_MACHINE
                                        }
                                    >
                                        <SelectTrigger
                                            id="record_equipment_id"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_MACHINE}>
                                                No machine yet
                                            </SelectItem>
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
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="record_title">
                                    What was done
                                </Label>
                                <Input
                                    id="record_title"
                                    name="title"
                                    defaultValue={record?.title ?? ''}
                                    placeholder="Annual service"
                                    maxLength={120}
                                    required
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="record_type">Type</Label>
                                    <Select
                                        name="type"
                                        defaultValue={
                                            record?.type ?? types[0]?.value
                                        }
                                        required
                                    >
                                        <SelectTrigger
                                            id="record_type"
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
                                    <Label htmlFor="record_status">
                                        Status
                                    </Label>
                                    <Select
                                        name="status"
                                        defaultValue={
                                            record?.status ??
                                            statuses.at(-1)?.value
                                        }
                                        required
                                    >
                                        <SelectTrigger
                                            id="record_status"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statuses.map((status) => (
                                                <SelectItem
                                                    key={status.value}
                                                    value={status.value}
                                                >
                                                    {status.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.status} />
                                </div>
                            </div>

                            <DaysField
                                id="record_day"
                                defaultDays={record?.days ?? [todayString()]}
                                errors={errors}
                            />

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="record_hours">Hours</Label>
                                    <Input
                                        id="record_hours"
                                        name="hours"
                                        type="number"
                                        step="0.25"
                                        min={0}
                                        defaultValue={record?.hours ?? ''}
                                        placeholder="1.5"
                                    />
                                    <InputError message={errors.hours} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="record_parts_cost">
                                        Parts cost
                                    </Label>
                                    <Input
                                        id="record_parts_cost"
                                        name="parts_cost"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        defaultValue={record?.parts_cost ?? ''}
                                        placeholder="0.00"
                                    />
                                    <InputError message={errors.parts_cost} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="record_labour_cost">
                                        Labour cost
                                    </Label>
                                    <Input
                                        id="record_labour_cost"
                                        name="labour_cost"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        defaultValue={record?.labour_cost ?? ''}
                                        placeholder="0.00"
                                    />
                                    <InputError message={errors.labour_cost} />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="record_description">
                                    Notes
                                </Label>
                                <Textarea
                                    id="record_description"
                                    name="description"
                                    defaultValue={record?.description ?? ''}
                                    placeholder="What was found and what was done about it."
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
                                    {record ? 'Save changes' : 'Log record'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
