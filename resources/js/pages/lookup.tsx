import { Form, Head, Link } from '@inertiajs/react';
import { Plus, ScanSearch, Search } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import MachineModel from '@/components/machine-model';
import MachineSpecsList from '@/components/machine-specs';
import PageHeader from '@/components/page-header';
import RepairGuide from '@/components/repair-guide';
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
import { lookup } from '@/routes';
import { create as createVehicle } from '@/routes/vehicles';
import type {
    CommonRepair,
    MachineKind,
    MachineSpecs,
    MaintenanceInterval,
    Recall,
    SelectOption,
} from '@/types';

export default function Lookup({
    identifier,
    is_vin: isVin,
    specs,
    kind,
    maintenance,
    repairs,
    recalls,
    kinds,
}: {
    identifier: string;
    is_vin: boolean;
    specs: MachineSpecs | null;
    kind: MachineKind;
    maintenance: MaintenanceInterval[];
    repairs: CommonRepair[];
    recalls?: Recall[];
    kinds: SelectOption[];
}) {
    const kindLabel =
        kinds.find((option) => option.value === kind)?.label ?? 'Machine';
    const engine = specs?.engine ?? {};
    const title = specs
        ? [specs.year, specs.make, specs.model].filter(Boolean).join(' ')
        : identifier;
    const engineSummary = summariseEngine(engine);

    return (
        <>
            <Head title="Lookup" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="VIN and serial lookup"
                    description="Type a VIN or serial number to see what it is, spin it round in 3D, and pull up its specs, service schedule and common repairs."
                />

                <Form
                    action={lookup.url()}
                    method="get"
                    className="bg-card rounded-xl border p-6"
                >
                    {({ processing }) => (
                        <div className="grid gap-4 md:grid-cols-[1fr_240px_auto] md:items-end">
                            <div className="grid gap-2">
                                <Label htmlFor="identifier">
                                    VIN or serial number
                                </Label>
                                <Input
                                    id="identifier"
                                    name="identifier"
                                    defaultValue={identifier}
                                    placeholder="MR0FZ22G001234567"
                                    className="font-mono uppercase"
                                    autoComplete="off"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="kind">Machine type</Label>
                                <Select
                                    name="kind"
                                    defaultValue={
                                        identifier !== '' && !isVin
                                            ? kind
                                            : 'auto'
                                    }
                                >
                                    <SelectTrigger id="kind" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Work it out from the VIN
                                        </SelectItem>
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
                            </div>

                            <Button type="submit" disabled={processing}>
                                <Search />
                                Look it up
                            </Button>
                        </div>
                    )}
                </Form>

                {identifier === '' ? (
                    <EmptyState
                        icon={ScanSearch}
                        title="Nothing looked up yet"
                        description="A 17-character VIN is decoded automatically. Serial numbers from mowers, outboards and small engines are not in any public decoder, so pick the machine type and you still get the model and service notes."
                    />
                ) : (
                    <>
                        <section className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
                            <div className="space-y-1">
                                <h2 className="text-xl font-semibold tracking-tight">
                                    {title}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {isVin
                                        ? specs
                                            ? [
                                                  `VIN ${identifier}`,
                                                  specs.body_class,
                                                  engineSummary,
                                              ]
                                                  .filter(Boolean)
                                                  .join(' · ')
                                            : `VIN ${identifier} · the decoder had nothing on this one. Pick the machine type above to carry on.`
                                        : `Serial ${identifier} · not a VIN, so this is a generic ${kindLabel.toLowerCase()}. Pick the machine type above if that is wrong.`}
                                </p>
                            </div>
                            <Button asChild>
                                <Link
                                    href={createVehicle.url({
                                        query: {
                                            vin: identifier,
                                            make: specs?.make ?? undefined,
                                            model: specs?.model ?? undefined,
                                            year: specs?.year ?? undefined,
                                            kind,
                                            cylinders:
                                                engine.cylinders ?? undefined,
                                            displacement_l:
                                                engine.displacement_l ??
                                                undefined,
                                            fuel: engine.fuel ?? undefined,
                                        },
                                    })}
                                >
                                    <Plus />
                                    Add to vehicles
                                </Link>
                            </Button>
                        </section>

                        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                            <MachineModel
                                kind={kind}
                                kindLabel={kindLabel}
                                engine={engine}
                                engineSummary={engineSummary}
                                doors={specs?.doors ?? null}
                            />

                            <aside className="bg-card h-fit rounded-xl border p-6">
                                <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
                                    Specs
                                </h2>
                                <MachineSpecsList
                                    specs={specs}
                                    engine={engine}
                                    engineSummary={engineSummary}
                                    kindLabel={kindLabel}
                                />
                            </aside>
                        </div>

                        <RepairGuide
                            maintenance={maintenance}
                            repairs={repairs}
                            recalls={recalls}
                            showRecalls={specs !== null}
                        />
                    </>
                )}
            </div>
        </>
    );
}

Lookup.layout = {
    breadcrumbs: [{ title: 'Lookup', href: lookup() }],
};

function summariseEngine(engine: MachineSpecs['engine']): string | null {
    const isVee = (engine.configuration ?? '').toLowerCase().startsWith('v');
    const parts = [
        engine.displacement_l ? `${engine.displacement_l} L` : null,
        engine.cylinders
            ? isVee
                ? `V${engine.cylinders}`
                : `${engine.cylinders}-cyl`
            : null,
        engine.fuel ? engine.fuel.toLowerCase() : null,
        engine.horsepower ? `${engine.horsepower} hp` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : null;
}
