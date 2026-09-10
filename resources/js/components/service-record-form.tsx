import { Form, Link } from '@inertiajs/react';
import { useState } from 'react';
import ServiceRecordController from '@/actions/App/Http/Controllers/ServiceRecordController';
import InputError from '@/components/input-error';
import ServiceRecordParts from '@/components/service-record-parts';
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
import { index } from '@/routes/service-records';
import type {
    SelectOption,
    ServiceRecord,
    StockedPart,
    UnitOption,
} from '@/types';

export default function ServiceRecordForm({
    record,
    vehicles,
    types,
    statuses,
    units,
    stockedParts,
    selectedVehicle,
}: {
    record?: ServiceRecord;
    vehicles: SelectOption[];
    types: SelectOption[];
    statuses: SelectOption[];
    units: UnitOption[];
    stockedParts: StockedPart[];
    selectedVehicle?: string;
}) {
    const action = record
        ? ServiceRecordController.update.form(record.id)
        : ServiceRecordController.store.form();

    const defaultVehicle = record
        ? String(record.vehicle_id)
        : (selectedVehicle ?? '');

    const [vehicleId, setVehicleId] = useState(defaultVehicle);

    return (
        <Form {...action} className="space-y-8">
            {({ processing, errors }) => (
                <>
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            The job
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="vehicle_id">Vehicle</Label>
                                <Select
                                    name="vehicle_id"
                                    value={vehicleId || undefined}
                                    onValueChange={setVehicleId}
                                    required
                                >
                                    <SelectTrigger
                                        id="vehicle_id"
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
                                <Label htmlFor="title">What was done</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    defaultValue={record?.title ?? ''}
                                    placeholder="Front brake pads and rotors"
                                    required
                                    autoFocus
                                />
                                <InputError message={errors.title} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="type">Category</Label>
                                <Select
                                    name="type"
                                    defaultValue={record?.type ?? 'other'}
                                >
                                    <SelectTrigger id="type" className="w-full">
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
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    name="status"
                                    defaultValue={record?.status ?? 'completed'}
                                >
                                    <SelectTrigger
                                        id="status"
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

                        <div className="grid gap-2">
                            <Label htmlFor="description">Work notes</Label>
                            <Textarea
                                id="description"
                                name="description"
                                defaultValue={record?.description ?? ''}
                                placeholder="Parts used, torque specs, what to watch next service."
                            />
                            <InputError message={errors.description} />
                        </div>
                    </section>

                    <ServiceRecordParts
                        parts={record?.parts}
                        stockedParts={stockedParts}
                        units={units}
                        vehicleId={vehicleId}
                    />

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Time &amp; cost
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="grid gap-2">
                                <Label htmlFor="performed_on">Date</Label>
                                <Input
                                    id="performed_on"
                                    name="performed_on"
                                    type="date"
                                    defaultValue={
                                        record?.performed_on ??
                                        new Date().toISOString().slice(0, 10)
                                    }
                                    required
                                />
                                <InputError message={errors.performed_on} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="odometer">Odometer (km)</Label>
                                <Input
                                    id="odometer"
                                    name="odometer"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    defaultValue={record?.odometer ?? ''}
                                    placeholder="128000"
                                />
                                <InputError message={errors.odometer} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="hours">Labour hours</Label>
                                <Input
                                    id="hours"
                                    name="hours"
                                    type="number"
                                    step="0.25"
                                    min={0}
                                    defaultValue={record?.hours ?? ''}
                                    placeholder="2.5"
                                />
                                <InputError message={errors.hours} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="parts_cost">Parts cost</Label>
                                <Input
                                    id="parts_cost"
                                    name="parts_cost"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    defaultValue={record?.parts_cost ?? ''}
                                    placeholder="240.00"
                                />
                                <InputError message={errors.parts_cost} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="labour_cost">Labour cost</Label>
                                <Input
                                    id="labour_cost"
                                    name="labour_cost"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    defaultValue={record?.labour_cost ?? ''}
                                    placeholder="180.00"
                                />
                                <InputError message={errors.labour_cost} />
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center gap-3 border-t pt-6">
                        <Button type="submit" disabled={processing}>
                            {record ? 'Save changes' : 'Log job'}
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
