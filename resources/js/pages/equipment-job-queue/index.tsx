import { Head, router, setLayoutProps } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import JobBoard from '@/components/job-board';
import PageHeader from '@/components/page-header';
import QuickJobDialog from '@/components/quick-job-dialog';
import { Button } from '@/components/ui/button';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { formatJobDates } from '@/lib/format';
import { show as showEquipment } from '@/routes/equipment';
import { update } from '@/routes/equipment-job-queue';
import type {
    EquipmentDivision,
    EquipmentServiceRecord,
    SelectOption,
} from '@/types';

/**
 * An equipment division's own job queue: only its own machines' jobs, kept
 * apart from Kaleb's Shop's vehicle jobs and from the other division's.
 */
export default function EquipmentJobQueue({
    division,
    jobs,
    equipment,
}: {
    division: EquipmentDivision;
    jobs: EquipmentServiceRecord[];
    equipment: SelectOption[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Job queue', href: divisionRoutes[division].jobQueue() },
        ],
    });

    return (
        <>
            <Head title="Equipment job queue" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Job queue"
                    description="Drag an equipment job between columns as it moves from not started, to in progress, to complete."
                    actions={
                        <QuickJobDialog
                            form={divisionRoutes[division].jobQueueStore.form()}
                            subject={{
                                name: 'equipment_id',
                                label: 'Equipment',
                                options: equipment,
                                placeholder: 'Pick a machine',
                            }}
                            titlePlaceholder="Replace the hydraulic hose"
                            trigger={
                                <Button size="sm">
                                    <Plus />
                                    Quick add
                                </Button>
                            }
                        />
                    }
                />

                <JobBoard
                    jobs={jobs}
                    moveUrl={(job) => update.url(job.id)}
                    onOpen={(job) =>
                        router.visit(showEquipment(job.equipment_id).url)
                    }
                    renderCard={(job) => (
                        <>
                            <p className="truncate font-medium">{job.title}</p>
                            <p className="text-muted-foreground truncate text-xs">
                                {job.equipment?.name}
                            </p>
                            <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                                <span className="truncate">
                                    {job.type_label}
                                </span>
                                <span className="shrink-0">
                                    {formatJobDates(job)}
                                </span>
                            </div>
                        </>
                    )}
                />
            </div>
        </>
    );
}
