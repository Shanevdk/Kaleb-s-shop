import { Car } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Fitment, FitmentOption } from '@/types';

type Selection = Record<string, { quantity: string; notes: string }>;

/**
 * Pick the vehicles a part fits and say how much of it each one takes, so the
 * vehicle page can work out what is needed and what is short.
 */
export default function VehicleFitmentPicker({
    vehicles,
    fitments = [],
    unitAbbreviation,
}: {
    vehicles: FitmentOption[];
    fitments?: Fitment[];
    unitAbbreviation?: string;
}) {
    const [selection, setSelection] = useState<Selection>(() =>
        Object.fromEntries(
            fitments.map((fitment) => [
                fitment.id,
                {
                    quantity: String(fitment.quantity_needed),
                    notes: fitment.notes ?? '',
                },
            ]),
        ),
    );

    const toggle = (vehicleId: string, checked: boolean) => {
        setSelection((current) => {
            const next = { ...current };

            if (checked) {
                next[vehicleId] = next[vehicleId] ?? {
                    quantity: '1',
                    notes: '',
                };
            } else {
                delete next[vehicleId];
            }

            return next;
        });
    };

    const setField = (
        vehicleId: string,
        field: 'quantity' | 'notes',
        value: string,
    ) => {
        setSelection((current) => ({
            ...current,
            [vehicleId]: { ...current[vehicleId], [field]: value },
        }));
    };

    if (vehicles.length === 0) {
        return (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                Add a vehicle first and you will be able to mark which ones this
                part fits.
            </p>
        );
    }

    const chosen = Object.keys(selection);

    return (
        <div className="space-y-3">
            <div className="divide-y rounded-lg border">
                {vehicles.map((vehicle) => {
                    const isChosen = vehicle.id in selection;

                    return (
                        <div
                            key={vehicle.id}
                            className="flex flex-wrap items-center gap-3 px-4 py-3"
                        >
                            <Checkbox
                                id={`fits-${vehicle.id}`}
                                checked={isChosen}
                                onCheckedChange={(checked) =>
                                    toggle(vehicle.id, checked === true)
                                }
                            />

                            <Label
                                htmlFor={`fits-${vehicle.id}`}
                                className="flex flex-1 items-center gap-2 font-normal"
                            >
                                <Car className="text-muted-foreground size-4 shrink-0" />
                                <span className="font-medium">
                                    {vehicle.display_name}
                                </span>
                                {vehicle.registration && (
                                    <span className="text-muted-foreground font-mono text-xs">
                                        {vehicle.registration}
                                    </span>
                                )}
                            </Label>

                            {isChosen && (
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor={`needs-${vehicle.id}`}
                                        className="text-muted-foreground text-xs font-normal"
                                    >
                                        Takes
                                    </Label>
                                    <Input
                                        id={`needs-${vehicle.id}`}
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        value={selection[vehicle.id].quantity}
                                        onChange={(event) =>
                                            setField(
                                                vehicle.id,
                                                'quantity',
                                                event.target.value,
                                            )
                                        }
                                        className="h-8 w-20 tabular-nums"
                                    />
                                    <span className="text-muted-foreground w-8 text-xs">
                                        {unitAbbreviation || 'ea'}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {chosen.map((vehicleId, index) => (
                <div key={vehicleId}>
                    <input
                        type="hidden"
                        name={`fitments[${index}][vehicle_id]`}
                        value={vehicleId}
                    />
                    <input
                        type="hidden"
                        name={`fitments[${index}][quantity_needed]`}
                        value={selection[vehicleId].quantity || '1'}
                    />
                    <input
                        type="hidden"
                        name={`fitments[${index}][notes]`}
                        value={selection[vehicleId].notes}
                    />
                </div>
            ))}
        </div>
    );
}
