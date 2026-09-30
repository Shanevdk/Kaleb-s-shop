import {
    Form,
    Head,
    Link,
    router,
    setLayoutProps,
    usePoll,
} from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ListChecks,
    Plus,
    Trash2,
    Undo2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import CheckStatusButtons from '@/components/check-status-buttons';
import DeleteConfirm from '@/components/delete-confirm';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import RepairPartsNote from '@/components/repair-parts-note';
import StatCard from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatOdometer } from '@/lib/format';
import { destroy, index, show, update } from '@/routes/inspections';
import {
    destroy as destroyItem,
    store as storeItem,
    update as updateItem,
} from '@/routes/inspection-items';
import { show as showVehicle } from '@/routes/vehicles';
import type {
    Inspection,
    InspectionItem,
    VehicleChecklistChanges,
} from '@/types';

/**
 * Take a check off the list. A check that has already been looked at asks
 * first, since whatever was found goes with it.
 */
function RemoveCheck({
    item,
    remember,
}: {
    item: InspectionItem;
    remember: boolean;
}) {
    const options = { query: { remember: remember ? '1' : '0' } };
    const needsConfirming = item.status !== 'pending' || Boolean(item.notes);
    const button = (
        <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-8 shrink-0"
            aria-label={`Remove ${item.label}`}
            onClick={
                needsConfirming
                    ? undefined
                    : () =>
                          router.delete(destroyItem.url(item.id, options), {
                              preserveScroll: true,
                          })
            }
        >
            <X />
        </Button>
    );

    return needsConfirming ? (
        <DeleteConfirm
            trigger={button}
            title="Remove this check?"
            description={`"${item.label}" has already been checked or has a note, and that goes with it.`}
            confirmLabel="Remove check"
            form={destroyItem.form(item.id, options)}
        />
    ) : (
        button
    );
}

/**
 * Add a check to the end of a section, or to a new one.
 */
function AddCheck({
    inspectionId,
    section,
    remember,
}: {
    inspectionId: string;
    section?: string;
    remember: boolean;
}) {
    return (
        <Form
            {...storeItem.form(inspectionId)}
            options={{ preserveScroll: true }}
            resetOnSuccess
            className="grid gap-2"
        >
            {({ processing, errors }) => (
                <>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {section === undefined ? (
                            <Input
                                name="section"
                                placeholder="Extra checks"
                                aria-label="Section"
                                className="h-8 sm:w-48"
                            />
                        ) : (
                            <input
                                type="hidden"
                                name="section"
                                value={section}
                            />
                        )}
                        <input
                            type="hidden"
                            name="remember"
                            value={remember ? '1' : '0'}
                        />
                        <Input
                            name="label"
                            placeholder={
                                section === undefined
                                    ? 'What needs checking'
                                    : `Add a check to ${section.toLowerCase()}`
                            }
                            aria-label={
                                section === undefined
                                    ? 'New check'
                                    : `New check for ${section}`
                            }
                            className="h-8 flex-1"
                        />
                        <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={processing}
                        >
                            <Plus />
                            Add
                        </Button>
                    </div>
                    <InputError message={errors.label} />
                </>
            )}
        </Form>
    );
}

export default function InspectionShow({
    inspection,
    vehicleChanges,
}: {
    inspection: Inspection;
    vehicleChanges: VehicleChecklistChanges;
}) {
    const vehicleName = inspection.vehicle?.display_name ?? 'Vehicle';
    const [remember, setRemember] = useState(true);
    const canEdit = !inspection.is_complete;

    setLayoutProps({
        breadcrumbs: [
            { title: 'Checklists', href: index() },
            { title: inspection.title, href: show(inspection.id) },
        ],
    });

    const items = inspection.items ?? [];
    const checked = items.filter((item) => item.status !== 'pending');
    const flagged = items.filter((item) => item.status === 'attention');
    const fixed = items.filter((item) => item.status === 'fixed');
    const progress = items.length
        ? Math.round((checked.length / items.length) * 100)
        : 0;

    const isPlanningParts = items.some(
        (item) => item.parts_status === 'pending',
    );
    const { start: startPolling, stop: stopPolling } = usePoll(
        3000,
        { only: ['inspection'] },
        { autoStart: false, mode: 'rest' },
    );

    useEffect(() => {
        if (isPlanningParts) {
            startPolling();
        } else {
            stopPolling();
        }
    }, [isPlanningParts, startPolling, stopPolling]);

    const sections = items.reduce<Record<string, InspectionItem[]>>(
        (grouped, item) => {
            grouped[item.section] = [...(grouped[item.section] ?? []), item];

            return grouped;
        },
        {},
    );

    const isAddedForVehicle = (item: InspectionItem) =>
        vehicleChanges.added.some(
            (check) =>
                check.label === item.label && check.section === item.section,
        );
    const leftOut = vehicleChanges.removed.filter(
        (check) => !items.some((item) => item.label === check.label),
    );

    const putBack = (section: string, label: string) => {
        router.post(
            storeItem.url(inspection.id),
            { section, label, remember: '1' },
            { preserveScroll: true },
        );
    };

    const saveNote = (item: InspectionItem, notes: string) => {
        if ((item.notes ?? '') === notes) {
            return;
        }

        router.patch(
            updateItem(item.id).url,
            { status: item.status, notes },
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <>
            <Head title={inspection.title} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={inspection.title}
                    description={`${vehicleName} · ${formatDate(inspection.performed_on)} · ${formatOdometer(inspection.odometer)}`}
                    actions={
                        <>
                            {inspection.vehicle && (
                                <Button variant="outline" asChild>
                                    <Link
                                        href={showVehicle(
                                            inspection.vehicle.id,
                                        )}
                                    >
                                        View vehicle
                                    </Link>
                                </Button>
                            )}
                            <DeleteConfirm
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete checklist"
                                    >
                                        <Trash2 />
                                    </Button>
                                }
                                title="Delete this checklist?"
                                description="The checklist and everything ticked off on it will be removed. This cannot be undone."
                                confirmLabel="Delete checklist"
                                form={destroy.form(inspection.id)}
                            />
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Checked"
                        value={`${checked.length} / ${items.length}`}
                        hint={`${progress}% done`}
                        icon={ListChecks}
                    />
                    <StatCard
                        label="Needs attention"
                        value={String(flagged.length)}
                        hint={`${fixed.length} fixed on this visit`}
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Status"
                        value={inspection.is_complete ? 'Signed off' : 'Open'}
                        hint={inspection.template_label}
                        icon={CheckCircle2}
                    />
                </div>

                <div
                    className="bg-muted h-2 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Checklist progress"
                >
                    <div
                        className="bg-primary h-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-6">
                        {canEdit && (
                            <div className="bg-card flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-5 py-3">
                                <Label className="flex items-center gap-2 font-normal">
                                    <Checkbox
                                        checked={remember}
                                        onCheckedChange={(checked) =>
                                            setRemember(checked === true)
                                        }
                                    />
                                    Remember checks I add or remove for{' '}
                                    {vehicleName}
                                </Label>
                                <span className="text-muted-foreground text-xs">
                                    {remember
                                        ? `They carry over to its next ${inspection.template_label.toLowerCase()}.`
                                        : 'Changes are for this checklist only.'}
                                </span>
                            </div>
                        )}

                        {Object.entries(sections).map(
                            ([section, sectionItems]) => (
                                <section
                                    key={section}
                                    className="bg-card rounded-xl border"
                                >
                                    <header className="flex items-center justify-between border-b px-5 py-3">
                                        <h2 className="font-semibold">
                                            {section}
                                        </h2>
                                        <span className="text-muted-foreground text-xs tabular-nums">
                                            {
                                                sectionItems.filter(
                                                    (item) =>
                                                        item.status !==
                                                        'pending',
                                                ).length
                                            }{' '}
                                            / {sectionItems.length}
                                        </span>
                                    </header>

                                    <ul className="divide-y">
                                        {sectionItems.map((item) => (
                                            <li
                                                key={item.id}
                                                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                                        {item.label}
                                                        {isAddedForVehicle(
                                                            item,
                                                        ) && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="font-normal"
                                                            >
                                                                This vehicle
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <Input
                                                        defaultValue={
                                                            item.notes ?? ''
                                                        }
                                                        placeholder="Add a note"
                                                        aria-label={`Note for ${item.label}`}
                                                        className="mt-2 h-8 border-0 border-b border-dashed px-0 text-sm shadow-none focus-visible:ring-0"
                                                        onBlur={(event) =>
                                                            saveNote(
                                                                item,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    {item.status ===
                                                        'attention' && (
                                                        <RepairPartsNote
                                                            item={item}
                                                            disabled={
                                                                inspection.is_complete
                                                            }
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <CheckStatusButtons
                                                        item={item}
                                                        disabled={
                                                            inspection.is_complete
                                                        }
                                                    />
                                                    {canEdit && (
                                                        <RemoveCheck
                                                            item={item}
                                                            remember={remember}
                                                        />
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>

                                    {canEdit && (
                                        <div className="border-t px-5 py-3">
                                            <AddCheck
                                                inspectionId={inspection.id}
                                                section={section}
                                                remember={remember}
                                            />
                                        </div>
                                    )}
                                </section>
                            ),
                        )}

                        {canEdit && (
                            <section className="bg-card space-y-3 rounded-xl border border-dashed px-5 py-4">
                                <div>
                                    <h2 className="font-semibold">
                                        Add a check in a new section
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        Leave the section blank to put it under
                                        extra checks.
                                    </p>
                                </div>
                                <AddCheck
                                    inspectionId={inspection.id}
                                    remember={remember}
                                />
                            </section>
                        )}

                        {canEdit && leftOut.length > 0 && (
                            <section className="bg-card space-y-3 rounded-xl border px-5 py-4">
                                <div>
                                    <h2 className="font-semibold">
                                        Left off for this vehicle
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        Standard checks taken off {vehicleName}
                                        's{' '}
                                        {inspection.template_label.toLowerCase()}
                                        .
                                    </p>
                                </div>
                                <ul className="divide-y">
                                    {leftOut.map((check) => (
                                        <li
                                            key={`${check.section}:${check.label}`}
                                            className="flex items-center justify-between gap-3 py-2 text-sm"
                                        >
                                            <span>
                                                {check.label}
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    · {check.section}
                                                </span>
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    putBack(
                                                        check.section,
                                                        check.label,
                                                    )
                                                }
                                            >
                                                <Undo2 />
                                                Put back
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>

                    <aside className="bg-card h-fit rounded-xl border p-6">
                        <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
                            Sign off
                        </h2>

                        <Form
                            {...update.form(inspection.id)}
                            options={{ preserveScroll: true }}
                            className="space-y-4"
                        >
                            {({ processing }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="notes">
                                            Overall notes
                                        </Label>
                                        <Textarea
                                            id="notes"
                                            name="notes"
                                            defaultValue={
                                                inspection.notes ?? ''
                                            }
                                            placeholder="What the customer needs to know."
                                        />
                                    </div>

                                    <input
                                        type="hidden"
                                        name="completed"
                                        value={
                                            inspection.is_complete ? '0' : '1'
                                        }
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        variant={
                                            inspection.is_complete
                                                ? 'outline'
                                                : 'default'
                                        }
                                        disabled={processing}
                                    >
                                        {inspection.is_complete
                                            ? 'Reopen checklist'
                                            : 'Save and sign off'}
                                    </Button>
                                </>
                            )}
                        </Form>

                        {flagged.length > 0 && (
                            <div className="mt-6 space-y-2 border-t pt-4">
                                <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                                    Needs work
                                </h3>
                                <ul className="space-y-1 text-sm">
                                    {flagged.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex items-start gap-2"
                                        >
                                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                                            <span>{item.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}
