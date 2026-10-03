import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    ClipboardCheck,
    Plus,
} from 'lucide-react';
import EmptyState from '@/components/empty-state';
import EquipmentChecklistDialog from '@/components/equipment-checklist-dialog';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { divisionRoutes } from '@/lib/equipment-divisions';
import { formatDate } from '@/lib/format';
import { show } from '@/routes/equipment-checklists';
import type {
    EquipmentChecklist,
    EquipmentDivision,
    SelectOption,
} from '@/types';

export default function EquipmentChecklistsIndex({
    division,
    checklists,
    equipment,
    filters,
}: {
    division: EquipmentDivision;
    checklists: EquipmentChecklist[];
    equipment: SelectOption[];
    filters: { equipment: string };
}) {
    const routes = divisionRoutes[division];

    setLayoutProps({
        breadcrumbs: [{ title: 'Checklists', href: routes.checklists() }],
    });

    const filterByEquipment = (selected: string) => {
        router.get(
            routes.checklists.url({
                query: {
                    equipment: selected === 'all' ? undefined : selected,
                },
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            <Head title="Checklists" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Checklists"
                    description="Pick a piece of equipment, work down the list, sign it off."
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <Link href={routes.schedule()}>
                                    <CalendarCheck />
                                    Schedule
                                </Link>
                            </Button>
                            {equipment.length > 0 && (
                                <EquipmentChecklistDialog
                                    trigger={
                                        <Button>
                                            <Plus />
                                            Start checklist
                                        </Button>
                                    }
                                    equipment={equipment}
                                />
                            )}
                        </>
                    }
                />

                {equipment.length > 0 && (
                    <Select
                        value={filters.equipment || 'all'}
                        onValueChange={filterByEquipment}
                    >
                        <SelectTrigger
                            className="w-full max-w-sm"
                            aria-label="Filter by equipment"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All equipment</SelectItem>
                            {equipment.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {checklists.length === 0 ? (
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No checklists yet"
                        description={
                            equipment.length > 0
                                ? 'Start one against a piece of equipment and add what needs checking as you go.'
                                : 'Add the first piece of equipment, then start a checklist against it.'
                        }
                        action={
                            equipment.length > 0 ? (
                                <EquipmentChecklistDialog
                                    trigger={
                                        <Button variant="outline">
                                            <Plus />
                                            Start checklist
                                        </Button>
                                    }
                                    equipment={equipment}
                                />
                            ) : (
                                <Button variant="outline" asChild>
                                    <Link href={routes.create()}>
                                        <Plus />
                                        Add equipment
                                    </Link>
                                </Button>
                            )
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {checklists.map((checklist) => {
                            const total = checklist.items_count ?? 0;
                            const done = checklist.checked_count ?? 0;
                            const progress = total
                                ? Math.round((done / total) * 100)
                                : 0;

                            return (
                                <Link
                                    key={checklist.id}
                                    href={show(checklist.id)}
                                    prefetch
                                    className="bg-card hover:border-foreground/40 flex flex-col gap-4 rounded-xl border p-5 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="leading-tight font-semibold">
                                                {checklist.title}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                {checklist.equipment?.name}
                                            </p>
                                        </div>
                                        <span className="text-muted-foreground shrink-0 text-xs">
                                            {formatDate(checklist.performed_on)}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full"
                                                style={{
                                                    width: `${progress}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-muted-foreground text-xs tabular-nums">
                                            {done} of {total} checked
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
                                        <span
                                            className={
                                                checklist.is_complete
                                                    ? 'font-medium'
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {checklist.is_complete
                                                ? 'Signed off'
                                                : 'In progress'}
                                        </span>
                                        {(checklist.flagged_count ?? 0) > 0 && (
                                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                                <AlertTriangle className="size-3.5" />
                                                {checklist.flagged_count} need
                                                attention
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
