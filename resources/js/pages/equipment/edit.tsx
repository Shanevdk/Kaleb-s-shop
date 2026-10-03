import { Head, setLayoutProps } from '@inertiajs/react';
import EquipmentForm from '@/components/equipment-form';
import PageHeader from '@/components/page-header';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { edit, show } from '@/routes/equipment';
import type { Equipment, SelectOption } from '@/types';

export default function EquipmentEdit({
    equipment,
    statuses,
}: {
    equipment: Equipment;
    statuses: SelectOption[];
}) {
    const { index } = divisionRoutes[equipment.division];

    setLayoutProps({
        breadcrumbs: [
            { title: 'Equipment', href: index() },
            { title: equipment.name, href: show(equipment.id) },
            { title: 'Edit', href: edit(equipment.id) },
        ],
    });

    return (
        <>
            <Head title={`Edit ${equipment.name}`} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={`Edit ${equipment.name}`}
                    description="Keep the equipment details current so the history stays accurate."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <EquipmentForm
                        division={equipment.division}
                        equipment={equipment}
                        statuses={statuses}
                    />
                </div>
            </div>
        </>
    );
}
