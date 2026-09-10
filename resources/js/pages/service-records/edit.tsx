import { Head, setLayoutProps } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import ServiceRecordForm from '@/components/service-record-form';
import { edit, index } from '@/routes/service-records';
import type {
    SelectOption,
    ServiceRecord,
    StockedPart,
    UnitOption,
} from '@/types';

export default function ServiceRecordEdit({
    record,
    vehicles,
    types,
    statuses,
    units,
    stockedParts,
}: {
    record: ServiceRecord;
    vehicles: SelectOption[];
    types: SelectOption[];
    statuses: SelectOption[];
    units: UnitOption[];
    stockedParts: StockedPart[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Service log', href: index() },
            { title: record.title, href: edit(record.id) },
        ],
    });

    return (
        <>
            <Head title={`Edit ${record.title}`} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Edit job"
                    description="Correct the details of this job or move it to another vehicle."
                />

                <div className="bg-card max-w-4xl rounded-xl border p-6">
                    <ServiceRecordForm
                        record={record}
                        vehicles={vehicles}
                        types={types}
                        statuses={statuses}
                        units={units}
                        stockedParts={stockedParts}
                    />
                </div>
            </div>
        </>
    );
}
