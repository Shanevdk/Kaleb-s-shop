import { Form, Head, Link, router } from '@inertiajs/react';
import { ClipboardCheck, Minus, Plus, RotateCcw } from 'lucide-react';
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
import { todayString } from '@/lib/format';
import { cn } from '@/lib/utils';
import { create, index } from '@/routes/inspections';
import { create as addVehicle } from '@/routes/vehicles';
import { destroy as resetChanges } from '@/routes/vehicles/checklist-changes';
import type {
    ChecklistTemplate,
    SelectOption,
    VehicleChecklistChanges,
} from '@/types';

export default function InspectionCreate({
    vehicles,
    templates,
    selectedVehicle,
    selectedTemplate,
    checklistChanges,
}: {
    vehicles: SelectOption[];
    templates: ChecklistTemplate[];
    selectedVehicle?: string;
    selectedTemplate?: string | null;
    /** Keyed by vehicle, then by checklist. */
    checklistChanges: Partial<
        Record<string, Partial<Record<string, VehicleChecklistChanges>>>
    >;
}) {
    const [template, setTemplate] = useState(
        selectedTemplate ?? templates[0]?.value ?? '',
    );
    const [vehicle, setVehicle] = useState(selectedVehicle ?? '');
    const changesFor = (value: string) =>
        vehicle ? checklistChanges[vehicle]?.[value] : undefined;
    const changes = changesFor(template);
    const templateLabel =
        templates.find((option) => option.value === template)?.label ?? '';

    /**
     * How many checks a checklist has, as changed for the chosen vehicle.
     */
    const itemCount = (option: ChecklistTemplate): string => {
        const forVehicle = changesFor(option.value);

        return forVehicle
            ? `${option.item_count + forVehicle.added.length - forVehicle.removed.length} items for this vehicle`
            : `${option.item_count} items`;
    };

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
                                                    onValueChange={setVehicle}
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
                                                    defaultValue={todayString()}
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
                                                        {itemCount(option)}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                        <InputError message={errors.template} />

                                        {changes && (
                                            <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm">
                                                <p className="font-medium">
                                                    This vehicle's{' '}
                                                    {templateLabel}:{' '}
                                                    {changes.added.length}{' '}
                                                    added,{' '}
                                                    {changes.removed.length}{' '}
                                                    removed
                                                </p>
                                                <ul className="space-y-1">
                                                    {changes.added.map(
                                                        (check) => (
                                                            <li
                                                                key={`added:${check.section}:${check.label}`}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Plus className="size-3.5 shrink-0 text-emerald-600" />
                                                                {check.label}
                                                                <span className="text-muted-foreground">
                                                                    ·{' '}
                                                                    {
                                                                        check.section
                                                                    }
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                    {changes.removed.map(
                                                        (check) => (
                                                            <li
                                                                key={`removed:${check.section}:${check.label}`}
                                                                className="text-muted-foreground flex items-center gap-2"
                                                            >
                                                                <Minus className="size-3.5 shrink-0 text-red-600" />
                                                                <span className="line-through">
                                                                    {
                                                                        check.label
                                                                    }
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.delete(
                                                            resetChanges.url({
                                                                vehicle,
                                                                template,
                                                            }),
                                                            {
                                                                preserveScroll: true,
                                                                preserveState: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <RotateCcw />
                                                    Reset to the standard list
                                                </Button>
                                            </div>
                                        )}
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
