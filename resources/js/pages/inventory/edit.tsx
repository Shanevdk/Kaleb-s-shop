import { Head, setLayoutProps } from '@inertiajs/react';
import InventoryItemForm from '@/components/inventory-item-form';
import PageHeader from '@/components/page-header';
import { edit, index } from '@/routes/inventory';
import type {
    FitmentOption,
    InventoryItem,
    SelectOption,
    UnitOption,
} from '@/types';

export default function InventoryEdit({
    item,
    categories,
    units,
    vehicles,
}: {
    item: InventoryItem;
    categories: SelectOption[];
    units: UnitOption[];
    vehicles: FitmentOption[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Inventory', href: index() },
            { title: item.name, href: edit(item.id) },
        ],
    });

    return (
        <>
            <Head title={`Edit ${item.name}`} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={item.name}
                    description="Update the stock count, the vehicles it fits, or the photo."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <InventoryItemForm
                        item={item}
                        categories={categories}
                        units={units}
                        vehicles={vehicles}
                    />
                </div>
            </div>
        </>
    );
}
