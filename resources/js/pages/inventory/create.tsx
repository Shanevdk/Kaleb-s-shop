import { Head } from '@inertiajs/react';
import InventoryItemForm from '@/components/inventory-item-form';
import PageHeader from '@/components/page-header';
import { create, index } from '@/routes/inventory';
import type { FitmentOption, SelectOption, UnitOption } from '@/types';

export default function InventoryCreate({
    categories,
    units,
    vehicles,
    scannedBarcode,
}: {
    categories: SelectOption[];
    units: UnitOption[];
    vehicles: FitmentOption[];
    scannedBarcode?: string;
}) {
    return (
        <>
            <Head title="Add part" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Add part"
                    description="Put a part on the shelf so you know what you have and when to reorder."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <InventoryItemForm
                        categories={categories}
                        units={units}
                        vehicles={vehicles}
                        scannedBarcode={scannedBarcode}
                    />
                </div>
            </div>
        </>
    );
}

InventoryCreate.layout = {
    breadcrumbs: [
        { title: 'Inventory', href: index() },
        { title: 'Add part', href: create() },
    ],
};
