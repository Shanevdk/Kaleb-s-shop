import { Head, Link } from '@inertiajs/react';
import { Car, Plus } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import ServiceRecordForm from '@/components/service-record-form';
import { Button } from '@/components/ui/button';
import { create, index } from '@/routes/service-records';
import { create as createVehicle } from '@/routes/vehicles';
import type { SelectOption, StockedPart, UnitOption } from '@/types';

export default function ServiceRecordCreate({
    vehicles,
    types,
    statuses,
    units,
    stockedParts,
    selectedVehicle,
}: {
    vehicles: SelectOption[];
    types: SelectOption[];
    statuses: SelectOption[];
    units: UnitOption[];
    stockedParts: StockedPart[];
    selectedVehicle: string;
}) {
    return (
        <>
            <Head title="Log job" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Log job"
                    description="Record what you did, how long it took and what it cost."
                />

                {vehicles.length === 0 ? (
                    <EmptyState
                        icon={Car}
                        title="Add a vehicle first"
                        description="Jobs are logged against a vehicle, so start by registering one."
                        action={
                            <Button asChild>
                                <Link href={createVehicle()}>
                                    <Plus />
                                    Add vehicle
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="bg-card max-w-4xl rounded-xl border p-6">
                        <ServiceRecordForm
                            vehicles={vehicles}
                            types={types}
                            statuses={statuses}
                            units={units}
                            stockedParts={stockedParts}
                            selectedVehicle={selectedVehicle}
                        />
                    </div>
                )}
            </div>
        </>
    );
}

ServiceRecordCreate.layout = {
    breadcrumbs: [
        { title: 'Service log', href: index() },
        { title: 'Log job', href: create() },
    ],
};
