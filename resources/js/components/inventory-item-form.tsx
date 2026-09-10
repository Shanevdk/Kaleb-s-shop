import { Form, Link } from '@inertiajs/react';
import { ImagePlus } from 'lucide-react';
import { useState } from 'react';
import InventoryItemController from '@/actions/App/Http/Controllers/InventoryItemController';
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
import VehicleFitmentPicker from '@/components/vehicle-fitment-picker';
import { index } from '@/routes/inventory';
import type {
    FitmentOption,
    InventoryItem,
    SelectOption,
    UnitOption,
} from '@/types';

export default function InventoryItemForm({
    item,
    categories,
    units,
    vehicles,
    scannedBarcode,
}: {
    item?: InventoryItem;
    categories: SelectOption[];
    units: UnitOption[];
    vehicles: FitmentOption[];
    scannedBarcode?: string;
}) {
    const [preview, setPreview] = useState<string | null>(
        item?.image_url ?? null,
    );
    const [removeImage, setRemoveImage] = useState(false);
    const [hasNewImage, setHasNewImage] = useState(false);
    const [unit, setUnit] = useState(item?.unit ?? 'each');

    const activeUnit = units.find((option) => option.value === unit);

    /**
     * PHP will not parse a multipart body on a PUT request, so an update that
     * carries a photo is posted with a spoofed method instead.
     */
    const spoofMethod = Boolean(item) && hasNewImage;

    const action = item
        ? spoofMethod
            ? {
                  action: InventoryItemController.update.url(item.id),
                  method: 'post' as const,
              }
            : InventoryItemController.update.form(item.id)
        : InventoryItemController.store.form();

    return (
        <Form
            {...action}
            transform={(data) =>
                spoofMethod ? { ...data, _method: 'put' } : data
            }
            className="space-y-8"
        >
            {({ processing, errors }) => (
                <>
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            The part
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={item?.name ?? ''}
                                    placeholder="Oil filter"
                                    required
                                    autoFocus
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    name="category"
                                    defaultValue={item?.category ?? 'other'}
                                >
                                    <SelectTrigger
                                        id="category"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((category) => (
                                            <SelectItem
                                                key={category.value}
                                                value={category.value}
                                            >
                                                {category.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.category} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="unit">Measured in</Label>
                                <Select
                                    name="unit"
                                    value={unit}
                                    onValueChange={setUnit}
                                >
                                    <SelectTrigger id="unit" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">
                                    {activeUnit?.is_measured
                                        ? 'Poured or cut, so you will be asked roughly how much you used.'
                                        : 'Counted one at a time.'}
                                </p>
                                <InputError message={errors.unit} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="grid gap-2">
                                <Label htmlFor="part_number">Part number</Label>
                                <Input
                                    id="part_number"
                                    name="part_number"
                                    defaultValue={item?.part_number ?? ''}
                                    placeholder="W712/75"
                                />
                                <InputError message={errors.part_number} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="barcode">
                                    Barcode{' '}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Input
                                    id="barcode"
                                    name="barcode"
                                    defaultValue={
                                        item?.barcode ?? scannedBarcode ?? ''
                                    }
                                    placeholder="9312345678907"
                                    autoComplete="off"
                                    className="font-mono"
                                />
                                <InputError message={errors.barcode} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="brand">Brand</Label>
                                <Input
                                    id="brand"
                                    name="brand"
                                    defaultValue={item?.brand ?? ''}
                                    placeholder="Bosch"
                                />
                                <InputError message={errors.brand} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="supplier">Supplier</Label>
                                <Input
                                    id="supplier"
                                    name="supplier"
                                    defaultValue={item?.supplier ?? ''}
                                    placeholder="Repco"
                                />
                                <InputError message={errors.supplier} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Stock
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-4">
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">
                                    On hand{' '}
                                    {activeUnit?.abbreviation && (
                                        <span className="text-muted-foreground font-normal">
                                            ({activeUnit.abbreviation})
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    id="quantity"
                                    name="quantity"
                                    type="number"
                                    inputMode="decimal"
                                    step={activeUnit?.step ?? 1}
                                    min={0}
                                    defaultValue={item?.quantity ?? 0}
                                    required
                                />
                                <InputError message={errors.quantity} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="minimum_quantity">
                                    Reorder at
                                </Label>
                                <Input
                                    id="minimum_quantity"
                                    name="minimum_quantity"
                                    type="number"
                                    inputMode="decimal"
                                    step={activeUnit?.step ?? 1}
                                    min={0}
                                    defaultValue={item?.minimum_quantity ?? 0}
                                    required
                                />
                                <InputError message={errors.minimum_quantity} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="unit_cost">Unit cost</Label>
                                <Input
                                    id="unit_cost"
                                    name="unit_cost"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min={0}
                                    defaultValue={item?.unit_cost ?? ''}
                                    placeholder="24.90"
                                />
                                <InputError message={errors.unit_cost} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="location">Shelf</Label>
                                <Input
                                    id="location"
                                    name="location"
                                    defaultValue={item?.location ?? ''}
                                    placeholder="Shelf A1"
                                />
                                <InputError message={errors.location} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                Fits these vehicles
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Tick the vehicles this part works on and say how
                                much each one takes. The vehicle page then shows
                                what it needs and what you are short.
                            </p>
                        </div>

                        <VehicleFitmentPicker
                            vehicles={vehicles}
                            fitments={item?.vehicles}
                            unitAbbreviation={activeUnit?.abbreviation}
                        />
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Photo
                        </h2>

                        <div className="flex flex-wrap items-start gap-5">
                            <div className="bg-muted flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                                {preview && !removeImage ? (
                                    <img
                                        src={preview}
                                        alt="Part preview"
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <ImagePlus className="text-muted-foreground size-6" />
                                )}
                            </div>

                            <div className="grid flex-1 gap-2">
                                <Label htmlFor="image">Upload a picture</Label>
                                <Input
                                    id="image"
                                    name="image"
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                        const file =
                                            event.target.files?.[0] ?? null;

                                        setRemoveImage(false);
                                        setHasNewImage(file !== null);
                                        setPreview(
                                            file
                                                ? URL.createObjectURL(file)
                                                : (item?.image_url ?? null),
                                        );
                                    }}
                                />
                                <p className="text-muted-foreground text-xs">
                                    JPG or PNG, up to 5 MB. Handy for telling
                                    lookalike parts apart on the shelf.
                                </p>
                                <InputError message={errors.image} />

                                {item?.image_url && (
                                    <label className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            name="remove_image"
                                            value="1"
                                            checked={removeImage}
                                            onChange={(event) =>
                                                setRemoveImage(
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                        Remove the current photo
                                    </label>
                                )}
                            </div>
                        </div>
                    </section>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            defaultValue={item?.notes ?? ''}
                            placeholder="Which vehicles it fits, supplier quirks, anything worth remembering."
                        />
                        <InputError message={errors.notes} />
                    </div>

                    <div className="flex items-center gap-3 border-t pt-6">
                        <Button type="submit" disabled={processing}>
                            {item ? 'Save changes' : 'Add to inventory'}
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
