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
import { todayString } from '@/lib/format';
import { store } from '@/routes/equipment-checklists';
import type { SelectOption } from '@/types';

/**
 * Start a checklist against a piece of equipment. It starts with the checks
 * on the equipment's default checklist, the last one started, and takes
 * over as the default itself; on a machine with none, checks are added once
 * it opens, the same way an ad hoc check is added to a vehicle's checklist.
 * Opened from the equipment's own page the equipment is already known;
 * opened from a division's checklists, it is picked from that division's
 * equipment.
 */
export default function EquipmentChecklistDialog({
    trigger,
    equipmentId,
    equipment = [],
    defaultChecklist = null,
}: {
    trigger: ReactNode;
    equipmentId?: string;
    defaultChecklist?: { id: string; title: string } | null;
    equipment?: SelectOption[];
}) {
    const [open, setOpen] = useState(false);
    const [pickedId, setPickedId] = useState('');
    const targetId = equipmentId ?? pickedId;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Start a checklist</DialogTitle>
                <DialogDescription>
                    {defaultChecklist
                        ? `Starts with the checks from ${defaultChecklist.title}, and becomes the default for next time.`
                        : equipmentId === undefined
                          ? "Starts with the checks from the machine's default checklist, if it has one, and becomes the default for next time."
                          : 'Add what needs checking once it opens. It becomes the default for next time.'}
                </DialogDescription>

                <Form
                    {...store.form(targetId)}
                    options={{ preserveScroll: true }}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            {equipmentId === undefined && (
                                <div className="grid gap-2">
                                    <Label htmlFor="checklist_equipment">
                                        Equipment
                                    </Label>
                                    <Select
                                        value={pickedId}
                                        onValueChange={setPickedId}
                                    >
                                        <SelectTrigger
                                            id="checklist_equipment"
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
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="checklist_title">Title</Label>
                                <Input
                                    id="checklist_title"
                                    name="title"
                                    placeholder="Safety check"
                                    defaultValue={defaultChecklist?.title}
                                    maxLength={120}
                                    required
                                />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="checklist_performed_on">
                                    Day
                                </Label>
                                <Input
                                    id="checklist_performed_on"
                                    name="performed_on"
                                    type="date"
                                    defaultValue={todayString()}
                                    required
                                />
                                <InputError message={errors.performed_on} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    disabled={processing || targetId === ''}
                                >
                                    Start checklist
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
