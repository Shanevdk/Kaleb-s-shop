import { Form, Link } from '@inertiajs/react';
import EquipmentController from '@/actions/App/Http/Controllers/EquipmentController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
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
import { index } from '@/routes/equipment';
import type { Equipment, SelectOption } from '@/types';

export default function EquipmentForm({
    equipment,
    statuses,
}: {
    equipment?: Equipment;
    statuses: SelectOption[];
}) {
    const action = equipment
        ? EquipmentController.update.form(equipment.id)
        : EquipmentController.store.form();

    return (
        <Form {...action} className="space-y-8">
            {({ processing, errors }) => (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={equipment?.name ?? ''}
                                placeholder="Shop air compressor"
                                required
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="category">
                                Category{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="category"
                                name="category"
                                defaultValue={equipment?.category ?? ''}
                                placeholder="Shop tool"
                            />
                            <InputError message={errors.category} />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="serial_number">
                                Serial number{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="serial_number"
                                name="serial_number"
                                defaultValue={equipment?.serial_number ?? ''}
                                placeholder="AB-1234"
                            />
                            <InputError message={errors.serial_number} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="location">
                                Location{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="location"
                                name="location"
                                defaultValue={equipment?.location ?? ''}
                                placeholder="Bay 2"
                            />
                            <InputError message={errors.location} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                name="status"
                                defaultValue={equipment?.status ?? 'active'}
                            >
                                <SelectTrigger id="status" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statuses.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.status} />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="purchased_on">
                                Purchased{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="purchased_on"
                                name="purchased_on"
                                type="date"
                                defaultValue={equipment?.purchased_on ?? ''}
                            />
                            <InputError message={errors.purchased_on} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            defaultValue={equipment?.notes ?? ''}
                            placeholder="Known issues, manuals, consumables it takes."
                        />
                        <InputError message={errors.notes} />
                    </div>

                    <div className="flex items-center gap-3 border-t pt-6">
                        <Button type="submit" disabled={processing}>
                            {equipment ? 'Save changes' : 'Add equipment'}
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={index()}>Cancel</Link>
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
