import { Form, Head, Link } from '@inertiajs/react';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import InspectionController from '@/actions/App/Http/Controllers/InspectionController';
import EmptyState from '@/components/empty-state';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
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
import { cn } from '@/lib/utils';
import { create, index } from '@/routes/inspections';
import { create as addVehicle } from '@/routes/vehicles';
import type { ChecklistTemplate, SelectOption } from '@/types';

export default function InspectionCreate({
    vehicles,
    templates,
    selectedVehicle,
}: {
    vehicles: SelectOption[];
    templates: ChecklistTemplate[];
    selectedVehicle?: string;
}) {
    const [template, setTemplate] = useState(templates[0]?.value ?? '');

    return (
        <>
            <Head title="Start a checklist" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Start a checklist"
                    description="Pick the vehicle, pick the checklist, then work down the list."
                />

                {vehicles.length === 0 ? (
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No vehicles to check"
                        description="Add a vehicle first, then you can run a checklist against it."
                        action={
                            <Button variant="outline" asChild>
                                <Link href={addVehicle()}>Add vehicle</Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="bg-card max-w-4xl rounded-xl border p-6">
                        <Form
                            {...InspectionController.store.form()}
                            className="space-y-8"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <section className="space-y-4">
                                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                            The vehicle
                                        </h2>

                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div className="grid gap-2 sm:col-span-1">
                                                <Label htmlFor="vehicle_id">
                                                    Vehicle
                                                </Label>
                                                <Select
                                                    name="vehicle_id"
                                                    defaultValue={
                                                        selectedVehicle ||
                                                        undefined
                                                    }
                                                    required
                                                >
                                                    <SelectTrigger
                                                        id="vehicle_id"
                                                        className="w-full"
                                                    >
                                                        <SelectValue placeholder="Pick a vehicle" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {vehicles.map(
                                                            (vehicle) => (
                                                                <SelectItem
                                                                    key={
                                                                        vehicle.value
                                                                    }
                                                                    value={
                                                                        vehicle.value
                                                                    }
                                                                >
                                                                    {
                                                                        vehicle.label
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    message={errors.vehicle_id}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="performed_on">
                                                    Date
                                                </Label>
                                                <Input
                                                    id="performed_on"
                                                    name="performed_on"
                                                    type="date"
                                                    defaultValue={new Date()
                                                        .toISOString()
                                                        .slice(0, 10)}
                                                    required
                                                />
                                                <InputError
                                                    message={
                                                        errors.performed_on
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="odometer">
                                                    Odometer (km)
                                                </Label>
                                                <Input
                                                    id="odometer"
                                                    name="odometer"
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    placeholder="128000"
                                                />
                                                <InputError
                                                    message={errors.odometer}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                            The checklist
                                        </h2>

                                        <input
                                            type="hidden"
                                            name="template"
                                            value={template}
                                        />

                                        <div
                                            role="radiogroup"
                                            aria-label="Checklist"
                                            className="grid gap-3 sm:grid-cols-2"
                                        >
                                            {templates.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={
                                                        template ===
                                                        option.value
                                                    }
                                                    onClick={() =>
                                                        setTemplate(
                                                            option.value,
                                                        )
                                                    }
                                                    className={cn(
                                                        'rounded-lg border p-4 text-left transition-colors',
                                                        template ===
                                                            option.value
                                                            ? 'border-foreground bg-muted'
                                                            : 'hover:border-foreground/40',
                                                    )}
                                                >
                                                    <p className="font-medium">
                                                        {option.label}
                                                    </p>
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {option.description}
                                                    </p>
                                                    <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                                                        {option.item_count}{' '}
                                                        items
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                        <InputError message={errors.template} />
                                    </section>

                                    <div className="flex items-center gap-3 border-t pt-6">
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Start checklist
                                        </Button>
                                        <Button variant="ghost" asChild>
                                            <Link href={index()}>Cancel</Link>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </div>
                )}
            </div>
        </>
    );
}

InspectionCreate.layout = {
    breadcrumbs: [
        { title: 'Checklists', href: index() },
        { title: 'Start a checklist', href: create() },
    ],
};
