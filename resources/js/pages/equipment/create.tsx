import { Head } from '@inertiajs/react';
import EquipmentForm from '@/components/equipment-form';
import PageHeader from '@/components/page-header';
import { create, index } from '@/routes/equipment';
import type { SelectOption } from '@/types';

export default function EquipmentCreate({
    statuses,
}: {
    statuses: SelectOption[];
}) {
    return (
        <>
            <Head title="Add equipment" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Add equipment"
                    description="Register a tool or machine so every job can be logged against it."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <EquipmentForm statuses={statuses} />
                </div>
            </div>
        </>
    );
}

EquipmentCreate.layout = {
    breadcrumbs: [
        { title: 'Equipment', href: index() },
        { title: 'Add equipment', href: create() },
    ],
};
