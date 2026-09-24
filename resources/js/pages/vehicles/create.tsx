import { Head } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import VehicleForm, { type VehiclePrefill } from '@/components/vehicle-form';
import { create, index } from '@/routes/vehicles';
import type { SelectOption } from '@/types';

export default function VehicleCreate({
    prefill,
    kinds,
}: {
    prefill: VehiclePrefill;
    kinds: SelectOption[];
}) {
    return (
        <>
            <Head title="Add vehicle" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Add vehicle"
                    description="Register a machine so every job can be logged against it."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <VehicleForm prefill={prefill} kinds={kinds} />
                </div>
            </div>
        </>
    );
}

VehicleCreate.layout = {
    breadcrumbs: [
        { title: 'Vehicles', href: index() },
        { title: 'Add vehicle', href: create() },
    ],
};
