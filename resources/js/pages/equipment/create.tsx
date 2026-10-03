import { Head, setLayoutProps } from '@inertiajs/react';
import EquipmentForm from '@/components/equipment-form';
import PageHeader from '@/components/page-header';
import { divisionRoutes } from '@/lib/equipment-divisions';
import type { EquipmentDivision, SelectOption } from '@/types';

export default function EquipmentCreate({
    division,
    statuses,
}: {
    division: EquipmentDivision;
    statuses: SelectOption[];
}) {
    const { create, index } = divisionRoutes[division];

    setLayoutProps({
        breadcrumbs: [
            { title: 'Equipment', href: index() },
            { title: 'Add equipment', href: create() },
        ],
    });

    return (
        <>
            <Head title="Add equipment" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Add equipment"
                    description="Register a tool or machine so every job can be logged against it."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <EquipmentForm division={division} statuses={statuses} />
                </div>
            </div>
        </>
    );
}
