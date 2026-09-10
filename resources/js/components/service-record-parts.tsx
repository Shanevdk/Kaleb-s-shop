import { AlertTriangle, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { formatQuantity } from '@/lib/format';
import type { ServiceRecordPart, StockedPart, UnitOption } from '@/types';

type PartRow = {
    key: string;
    id: string | null;
    inventoryItemId: string;
    name: string;
    quantity: string;
    unit: string;
    quantityTaken: number;
};

let nextKey = 0;

/**
 * List the parts a job calls for. Anything the shelf cannot cover is flagged
 * here and rolls up into the shopping list.
 */
export default function ServiceRecordParts({
    parts = [],
    stockedParts,
    units,
    vehicleId,
}: {
    parts?: ServiceRecordPart[];
    stockedParts: StockedPart[];
    units: UnitOption[];
    vehicleId: string;
}) {
    const [rows, setRows] = useState<PartRow[]>(() =>
        parts.map((part) => ({
            key: `existing-${part.id}`,
            id: part.id,
            inventoryItemId: part.inventory_item_id
                ? String(part.inventory_item_id)
                : '',
            name: part.name,
            quantity: String(part.quantity),
            unit: part.unit,
            quantityTaken: part.quantity_taken,
        })),
    );

    const stockById = useMemo(
        () => new Map(stockedParts.map((part) => [String(part.id), part])),
        [stockedParts],
    );

    /** The parts marked as fitting the chosen vehicle that are not listed yet. */
    const suggestions = useMemo(() => {
        if (!vehicleId) {
            return [];
        }

        const listed = new Set(rows.map((row) => row.inventoryItemId));

        return stockedParts.filter(
            (part) =>
                !listed.has(String(part.id)) &&
                part.fits.some(
                    (fit) => String(fit.vehicle_id) === String(vehicleId),
                ),
        );
    }, [rows, stockedParts, vehicleId]);

    const addRow = (part?: StockedPart) => {
        const needed = part?.fits.find(
            (fit) => String(fit.vehicle_id) === String(vehicleId),
        );

        setRows((current) => [
            ...current,
            {
                key: `new-${nextKey++}`,
                id: null,
                inventoryItemId: part ? String(part.id) : '',
                name: part?.name ?? '',
                quantity: String(needed?.quantity_needed ?? 1),
                unit: part?.unit ?? 'each',
                quantityTaken: 0,
            },
        ]);
    };

    const setRow = (key: string, changes: Partial<PartRow>) => {
        setRows((current) =>
            current.map((row) =>
                row.key === key ? { ...row, ...changes } : row,
            ),
        );
    };

    const removeRow = (key: string) => {
        setRows((current) => current.filter((row) => row.key !== key));
    };

    const pickStockedPart = (key: string, value: string) => {
        const part = stockById.get(value);

        setRow(key, {
            inventoryItemId: value === 'custom' ? '' : value,
            ...(part ? { name: part.name, unit: part.unit } : {}),
        });
    };

    const shortfallFor = (row: PartRow): number => {
        const onHand = stockById.get(row.inventoryItemId)?.quantity ?? 0;
        const outstanding = Math.max(
            0,
            Number(row.quantity || 0) - row.quantityTaken,
        );

        return Math.max(0, outstanding - onHand);
    };

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                    Parts used
                </h2>
                <p className="text-muted-foreground text-sm">
                    Saving the job as completed takes these off the shelf for
                    you. Until then they stay on the shopping list, and anything
                    you do not have enough of is flagged below.
                </p>
            </div>

            {suggestions.length > 0 && (
                <div className="bg-muted/50 space-y-2 rounded-lg border border-dashed p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="size-4" />
                        This vehicle usually takes
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((part) => (
                            <Button
                                key={part.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addRow(part)}
                            >
                                <Plus />
                                {part.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {rows.length > 0 && (
                <div className="space-y-3">
                    {rows.map((row, index) => {
                        const shortfall = shortfallFor(row);

                        return (
                            <div
                                key={row.key}
                                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto_auto]"
                            >
                                <div className="grid gap-2">
                                    <Label
                                        htmlFor={`part-name-${row.key}`}
                                        className="text-xs"
                                    >
                                        Part
                                    </Label>
                                    <Select
                                        value={row.inventoryItemId || 'custom'}
                                        onValueChange={(value) =>
                                            pickStockedPart(row.key, value)
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="custom">
                                                Not in inventory
                                            </SelectItem>
                                            {stockedParts.map((part) => (
                                                <SelectItem
                                                    key={part.id}
                                                    value={String(part.id)}
                                                >
                                                    {part.name}
                                                    {part.part_number
                                                        ? ` · ${part.part_number}`
                                                        : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id={`part-name-${row.key}`}
                                        value={row.name}
                                        onChange={(event) =>
                                            setRow(row.key, {
                                                name: event.target.value,
                                            })
                                        }
                                        placeholder="Rear wheel bearing"
                                        required
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label
                                        htmlFor={`part-qty-${row.key}`}
                                        className="text-xs"
                                    >
                                        How many
                                    </Label>
                                    <Input
                                        id={`part-qty-${row.key}`}
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        value={row.quantity}
                                        onChange={(event) =>
                                            setRow(row.key, {
                                                quantity: event.target.value,
                                            })
                                        }
                                        className="w-24 tabular-nums"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs">Unit</Label>
                                    <Select
                                        value={row.unit}
                                        onValueChange={(unit) =>
                                            setRow(row.key, { unit })
                                        }
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {units.map((unit) => (
                                                <SelectItem
                                                    key={unit.value}
                                                    value={unit.value}
                                                >
                                                    {unit.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-end justify-between gap-2 sm:justify-end">
                                    {row.quantityTaken > 0 && (
                                        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white tabular-nums dark:bg-emerald-500 dark:text-emerald-950">
                                            <Check className="size-3" />
                                            Took{' '}
                                            {formatQuantity(
                                                row.quantityTaken,
                                                stockById.get(
                                                    row.inventoryItemId,
                                                )?.unit_abbreviation,
                                            )}
                                        </span>
                                    )}
                                    {shortfall > 0 && (
                                        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 tabular-nums">
                                            <AlertTriangle className="size-3" />
                                            Short{' '}
                                            {formatQuantity(
                                                shortfall,
                                                stockById.get(
                                                    row.inventoryItemId,
                                                )?.unit_abbreviation,
                                            )}
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mb-1"
                                        aria-label={`Remove ${row.name || 'this part'}`}
                                        onClick={() => removeRow(row.key)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>

                                {row.id !== null && (
                                    <input
                                        type="hidden"
                                        name={`parts[${index}][id]`}
                                        value={row.id}
                                    />
                                )}
                                <input
                                    type="hidden"
                                    name={`parts[${index}][name]`}
                                    value={row.name}
                                />
                                <input
                                    type="hidden"
                                    name={`parts[${index}][inventory_item_id]`}
                                    value={row.inventoryItemId}
                                />
                                <input
                                    type="hidden"
                                    name={`parts[${index}][quantity]`}
                                    value={row.quantity || '1'}
                                />
                                <input
                                    type="hidden"
                                    name={`parts[${index}][unit]`}
                                    value={row.unit}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRow()}
            >
                <Plus />
                Add a part
            </Button>
        </section>
    );
}
