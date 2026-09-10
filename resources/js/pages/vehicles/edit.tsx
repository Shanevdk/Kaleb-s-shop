import { Head, setLayoutProps } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import VehicleForm from '@/components/vehicle-form';
import { edit, index, show } from '@/routes/vehicles';
import type { Vehicle } from '@/types';

export default function VehicleEdit({ vehicle }: { vehicle: Vehicle }) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Vehicles', href: index() },
            { title: vehicle.display_name, href: show(vehicle.id) },
            { title: 'Edit', href: edit(vehicle.id) },
        ],
    });

    return (
        <>
            <Head title={`Edit ${vehicle.display_name}`} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={`Edit ${vehicle.display_name}`}
                    description="Keep the vehicle details current so the history stays accurate."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <VehicleForm vehicle={vehicle} />
                </div>
            </div>
        </>
    );
}
