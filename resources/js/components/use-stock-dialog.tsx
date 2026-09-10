import { router } from '@inertiajs/react';
import { Minus } from 'lucide-react';
import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatQuantity } from '@/lib/format';
import { adjust } from '@/routes/inventory';
import type { InventoryItem, SelectOption } from '@/types';

/**
 * Ask roughly how much of a poured or cut part went into a job, then take that
 * much off the shelf. Nobody measures the last drop, so the quick amounts do
 * most of the work and the box takes anything in between.
 */
export default function UseStockDialog({
    item,
    vehicles = [],
    defaultVehicle,
}: {
    item: InventoryItem;
    vehicles?: SelectOption[];
    defaultVehicle?: string;
}) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [vehicleId, setVehicleId] = useState(defaultVehicle ?? '');
    const [note, setNote] = useState('');

    const used = Number(amount);
    const isValid = Number.isFinite(used) && used > 0;
    const remaining = Math.max(0, item.quantity - (isValid ? used : 0));

    const submit = () => {
        if (!isValid) {
            return;
        }

        router.patch(
            adjust(item.id).url,
            {
                delta: -used,
                vehicle_id: vehicleId || null,
                note: note || null,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setOpen(false);
                    setAmount('');
                    setNote('');
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={item.quantity === 0}
                    aria-label={`Log how much ${item.name} you used`}
                >
                    <Minus />
                    Used some
                </Button>
            </DialogTrigger>

            <DialogContent>
                <DialogTitle>How much {item.name} did you use?</DialogTitle>
                <DialogDescription>
                    Roughly is fine. There is{' '}
                    {formatQuantity(item.quantity, item.unit_abbreviation)} on
                    the shelf.
                </DialogDescription>

                <div className="space-y-4 py-2">
                    <div className="flex flex-wrap gap-2">
                        {item.quick_amounts.map((quick) => (
                            <Button
                                key={quick}
                                type="button"
                                variant={
                                    Number(amount) === quick
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                onClick={() => setAmount(String(quick))}
                            >
                                {formatQuantity(quick, item.unit_abbreviation)}
                            </Button>
                        ))}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`used-${item.id}`}>
                            Amount used
                            {item.unit_abbreviation
                                ? ` (${item.unit_abbreviation})`
                                : ''}
                        </Label>
                        <Input
                            id={`used-${item.id}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={item.unit_step}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder={String(item.quick_amounts[0] ?? 1)}
                            autoFocus
                        />
                    </div>

                    {vehicles.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor={`used-vehicle-${item.id}`}>
                                Which vehicle?{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Select
                                value={vehicleId || 'none'}
                                onValueChange={(value) =>
                                    setVehicleId(value === 'none' ? '' : value)
                                }
                            >
                                <SelectTrigger
                                    id={`used-vehicle-${item.id}`}
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        Not recorded
                                    </SelectItem>
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
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor={`used-note-${item.id}`}>
                            Note{' '}
                            <span className="text-muted-foreground font-normal">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id={`used-note-${item.id}`}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Topped up the gearbox"
                            maxLength={120}
                        />
                    </div>

                    {isValid && (
                        <p className="text-muted-foreground text-sm">
                            That leaves{' '}
                            <span className="text-foreground font-medium tabular-nums">
                                {formatQuantity(
                                    remaining,
                                    item.unit_abbreviation,
                                )}
                            </span>
                            {remaining <= item.minimum_quantity &&
                                ' — at or below your reorder point.'}
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary" type="button">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={submit} disabled={!isValid}>
                        Take it off the shelf
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
