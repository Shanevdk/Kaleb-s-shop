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
import { todayString } from '@/lib/format';
import { store } from '@/routes/equipment-checklists';

/**
 * Start a checklist against a piece of equipment. Items are added once it
 * opens, the same way an ad hoc check is added to a vehicle's checklist.
 */
export default function EquipmentChecklistDialog({
    trigger,
    equipmentId,
}: {
    trigger: ReactNode;
    equipmentId: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Start a checklist</DialogTitle>
                <DialogDescription>
                    Add what needs checking once it opens.
                </DialogDescription>

                <Form
                    {...store.form(equipmentId)}
                    options={{ preserveScroll: true }}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="checklist_title">Title</Label>
                                <Input
                                    id="checklist_title"
                                    name="title"
                                    placeholder="Safety check"
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
                                <Button type="submit" disabled={processing}>
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
