import { AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { EngineSpecs, MachineSpecs } from '@/types';

/**
 * The spec sheet for a machine: whatever the VIN decoder found, or whatever
 * the mechanic typed in. Blank rows are left out.
 */
export default function MachineSpecsList({
    specs,
    engine,
    engineSummary,
    kindLabel,
}: {
    specs: MachineSpecs | null;
    engine: Partial<EngineSpecs>;
    engineSummary?: string | null;
    kindLabel: string;
}) {
    const power = [
        engine.horsepower ? `${engine.horsepower} hp` : null,
        engine.kilowatts ? `${engine.kilowatts} kW` : null,
    ]
        .filter(Boolean)
        .join(' / ');

    const rows: { label: string; value: string | null | undefined }[] = [
        { label: 'Type', value: kindLabel },
        { label: 'Body', value: specs?.body_class },
        {
            label: 'Trim',
            value:
                [specs?.series, specs?.trim].filter(Boolean).join(' ') || null,
        },
        { label: 'Engine', value: engineSummary },
        {
            label: 'Cylinders',
            value: engine.cylinders ? String(engine.cylinders) : null,
        },
        {
            label: 'Displacement',
            value: engine.displacement_l ? `${engine.displacement_l} L` : null,
        },
        { label: 'Layout', value: engine.configuration },
        { label: 'Fuel', value: engine.fuel },
        { label: 'Power', value: power || null },
        {
            label: 'Turbo',
            value:
                engine.turbo === null || engine.turbo === undefined
                    ? null
                    : engine.turbo
                      ? 'Yes'
                      : 'No',
        },
        { label: 'Engine code', value: engine.model },
        { label: 'Drive', value: specs?.drive_type },
        { label: 'Transmission', value: specs?.transmission },
        { label: 'Doors', value: specs?.doors ? String(specs.doors) : null },
        { label: 'GVWR', value: specs?.gvwr },
        { label: 'Built by', value: specs?.manufacturer },
        { label: 'Built at', value: specs?.plant },
    ].filter((row) => row.value);

    if (rows.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                No specs yet. Add a VIN, or type the engine details in by hand.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <dl className="space-y-3 text-sm">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                    >
                        <dt className="text-muted-foreground shrink-0">
                            {row.label}
                        </dt>
                        <dd className="text-right font-medium">{row.value}</dd>
                    </div>
                ))}
            </dl>

            {specs?.warnings && (
                <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                    <span>{specs.warnings}</span>
                </p>
            )}

            <p className="text-muted-foreground text-xs">
                {specs?.source === 'nhtsa'
                    ? `Decoded from the VIN via NHTSA${specs.decoded_at ? ` on ${formatDate(specs.decoded_at.slice(0, 10))}` : ''}.`
                    : 'Entered by hand.'}
            </p>
        </div>
    );
}
