import { Form, Head, Link, router, setLayoutProps } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ListChecks, Trash2 } from 'lucide-react';
import CheckStatusButtons from '@/components/check-status-buttons';
import DeleteConfirm from '@/components/delete-confirm';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatOdometer } from '@/lib/format';
import { destroy, index, show, update } from '@/routes/inspections';
import { update as updateItem } from '@/routes/inspection-items';
import { show as showVehicle } from '@/routes/vehicles';
import type { Inspection, InspectionItem } from '@/types';

export default function InspectionShow({
    inspection,
}: {
    inspection: Inspection;
}) {
    const vehicleName = inspection.vehicle?.display_name ?? 'Vehicle';

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

    const sections = items.reduce<Record<string, InspectionItem[]>>(
        (grouped, item) => {
            grouped[item.section] = [...(grouped[item.section] ?? []), item];

            return grouped;
        },
        {},
    );

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
                                                    <p className="font-medium">
                                                        {item.label}
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
                                                </div>

                                                <CheckStatusButtons
                                                    item={item}
                                                    disabled={
                                                        inspection.is_complete
                                                    }
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ),
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
