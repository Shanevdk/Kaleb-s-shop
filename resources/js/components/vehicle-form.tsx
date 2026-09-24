import { Form, Link, useHttp } from '@inertiajs/react';
import { Loader2, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import VehicleController from '@/actions/App/Http/Controllers/VehicleController';
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
import { decode } from '@/routes/lookup';
import { index } from '@/routes/vehicles';
import type { MachineSpecs, SelectOption, Vehicle } from '@/types';

export type VehiclePrefill = Partial<
    Record<
        | 'vin'
        | 'make'
        | 'model'
        | 'year'
        | 'kind'
        | 'cylinders'
        | 'displacement_l'
        | 'fuel',
        string | number | null
    >
>;

type DecodeResponse = {
    is_vin: boolean;
    specs: MachineSpecs | null;
};

/**
 * The fields the VIN decoder can fill in. They are controlled so a decode
 * can overwrite them; everything else stays uncontrolled.
 */
type Identity = {
    make: string;
    model: string;
    year: string;
    vin: string;
    kind: string;
    cylinders: string;
    displacement_l: string;
    fuel: string;
};

const asText = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

export default function VehicleForm({
    vehicle,
    prefill,
    kinds,
}: {
    vehicle?: Vehicle;
    prefill?: VehiclePrefill;
    kinds: SelectOption[];
}) {
    const action = vehicle
        ? VehicleController.update.form(vehicle.id)
        : VehicleController.store.form();

    const [fields, setFields] = useState<Identity>(() => ({
        make: vehicle?.make ?? asText(prefill?.make),
        model: vehicle?.model ?? asText(prefill?.model),
        year: asText(vehicle?.year ?? prefill?.year),
        vin: vehicle?.vin ?? asText(prefill?.vin),
        kind: vehicle?.kind ?? asText(prefill?.kind) ?? '',
        cylinders: asText(vehicle?.engine.cylinders ?? prefill?.cylinders),
        displacement_l: asText(
            vehicle?.engine.displacement_l ?? prefill?.displacement_l,
        ),
        fuel: vehicle?.engine.fuel ?? asText(prefill?.fuel),
    }));
    const [decodeNote, setDecodeNote] = useState<string | null>(null);

    const decoder = useHttp<{ vin: string }, DecodeResponse>({ vin: '' });

    function set<K extends keyof Identity>(key: K, value: string): void {
        setFields((current) => ({ ...current, [key]: value }));
    }

    function decodeVin(): void {
        const vin = fields.vin.replace(/[\s-]+/g, '').toUpperCase();

        if (vin === '') {
            setDecodeNote('Type the VIN first.');

            return;
        }

        set('vin', vin);
        setDecodeNote(null);

        decoder.transform(() => ({ vin }));
        decoder
            .get(decode.url())
            .then((response) => {
                if (!response.is_vin) {
                    setDecodeNote(
                        'That is not a 17-character VIN, so it is treated as a serial number. Pick the machine type and fill in the engine by hand.',
                    );

                    return;
                }

                const specs = response.specs;

                if (!specs) {
                    setDecodeNote(
                        'The decoder had nothing on that VIN. Fill the details in by hand.',
                    );

                    return;
                }

                setFields((current) => ({
                    ...current,
                    make: specs.make ?? current.make,
                    model: specs.model ?? current.model,
                    year: specs.year ? String(specs.year) : current.year,
                    kind: specs.kind ?? current.kind,
                    cylinders:
                        asText(specs.engine.cylinders) || current.cylinders,
                    displacement_l:
                        asText(specs.engine.displacement_l) ||
                        current.displacement_l,
                    fuel: specs.engine.fuel ?? current.fuel,
                }));
                setDecodeNote(
                    `Decoded: ${[specs.year, specs.make, specs.model, specs.body_class].filter(Boolean).join(' ')}. Check it and save.`,
                );
            })
            .catch(() => {
                setDecodeNote(
                    'Could not reach the decoder. Try again in a moment or fill the details in by hand.',
                );
            });
    }

    return (
        <Form {...action} className="space-y-8">
            {({ processing, errors }) => (
                <>
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Identify it
                        </h2>

                        <div className="grid gap-2">
                            <Label htmlFor="vin">VIN or serial number</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="vin"
                                    name="vin"
                                    value={fields.vin}
                                    onChange={(event) =>
                                        set('vin', event.target.value)
                                    }
                                    placeholder="MR0FZ22G001234567"
                                    className="font-mono uppercase"
                                    autoComplete="off"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={decodeVin}
                                    disabled={decoder.processing}
                                >
                                    {decoder.processing ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        <ScanSearch />
                                    )}
                                    Decode
                                </Button>
                            </div>
                            {decodeNote ? (
                                <p className="text-muted-foreground text-xs">
                                    {decodeNote}
                                </p>
                            ) : (
                                <p className="text-muted-foreground text-xs">
                                    A 17-character VIN fills in the make, model,
                                    year, body and engine for you.
                                </p>
                            )}
                            <InputError message={errors.vin} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="make">Make</Label>
                                <Input
                                    id="make"
                                    name="make"
                                    value={fields.make}
                                    onChange={(event) =>
                                        set('make', event.target.value)
                                    }
                                    placeholder="Toyota"
                                    required
                                />
                                <InputError message={errors.make} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="model">Model</Label>
                                <Input
                                    id="model"
                                    name="model"
                                    value={fields.model}
                                    onChange={(event) =>
                                        set('model', event.target.value)
                                    }
                                    placeholder="Hilux"
                                    required
                                />
                                <InputError message={errors.model} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="year">Year</Label>
                                <Input
                                    id="year"
                                    name="year"
                                    type="number"
                                    inputMode="numeric"
                                    min={1900}
                                    max={new Date().getFullYear() + 1}
                                    value={fields.year}
                                    onChange={(event) =>
                                        set('year', event.target.value)
                                    }
                                    placeholder="2018"
                                    required
                                />
                                <InputError message={errors.year} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="kind">Machine type</Label>
                                <Select
                                    name="kind"
                                    value={fields.kind || 'other'}
                                    onValueChange={(value) =>
                                        set('kind', value)
                                    }
                                >
                                    <SelectTrigger id="kind" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {kinds.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.kind} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="nickname">
                                    Nickname{' '}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Input
                                    id="nickname"
                                    name="nickname"
                                    defaultValue={vehicle?.nickname ?? ''}
                                    placeholder="Work ute"
                                />
                                <InputError message={errors.nickname} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="colour">Colour</Label>
                                <Input
                                    id="colour"
                                    name="colour"
                                    defaultValue={vehicle?.colour ?? ''}
                                    placeholder="Gunmetal grey"
                                />
                                <InputError message={errors.colour} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Engine
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Filled in from the VIN where it can be. Type it in
                            for anything with a serial number, and the 3D model
                            and service schedule follow.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cylinders">Cylinders</Label>
                                <Input
                                    id="cylinders"
                                    name="cylinders"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={16}
                                    value={fields.cylinders}
                                    onChange={(event) =>
                                        set('cylinders', event.target.value)
                                    }
                                    placeholder="4"
                                />
                                <InputError message={errors.cylinders} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="displacement_l">
                                    Displacement (L)
                                </Label>
                                <Input
                                    id="displacement_l"
                                    name="displacement_l"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min={0.01}
                                    max={100}
                                    value={fields.displacement_l}
                                    onChange={(event) =>
                                        set(
                                            'displacement_l',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="2.8"
                                />
                                <InputError message={errors.displacement_l} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="fuel">Fuel</Label>
                                <Input
                                    id="fuel"
                                    name="fuel"
                                    value={fields.fuel}
                                    onChange={(event) =>
                                        set('fuel', event.target.value)
                                    }
                                    placeholder="Diesel"
                                    list="fuel-types"
                                />
                                <datalist id="fuel-types">
                                    <option value="Petrol" />
                                    <option value="Diesel" />
                                    <option value="LPG" />
                                    <option value="Electric" />
                                    <option value="Hybrid" />
                                </datalist>
                                <InputError message={errors.fuel} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Registration &amp; condition
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="registration">Plate</Label>
                                <Input
                                    id="registration"
                                    name="registration"
                                    defaultValue={vehicle?.registration ?? ''}
                                    placeholder="ABC123"
                                    className="uppercase"
                                />
                                <InputError message={errors.registration} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="odometer">Odometer (km)</Label>
                                <Input
                                    id="odometer"
                                    name="odometer"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    defaultValue={vehicle?.odometer ?? ''}
                                    placeholder="128000"
                                />
                                <InputError message={errors.odometer} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                defaultValue={vehicle?.notes ?? ''}
                                placeholder="Known issues, owner preferences, parts fitted."
                            />
                            <InputError message={errors.notes} />
                        </div>
                    </section>

                    <div className="flex items-center gap-3 border-t pt-6">
                        <Button type="submit" disabled={processing}>
                            {vehicle ? 'Save changes' : 'Add vehicle'}
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
