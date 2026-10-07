import { Form, Head, Link, router, setLayoutProps } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ListChecks,
    Plus,
    Star,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import DeleteConfirm from '@/components/delete-confirm';
import EquipmentCheckStatusButtons from '@/components/equipment-check-status-buttons';
import InputError from '@/components/input-error';
import NoteInput from '@/components/note-input';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { show as showEquipment } from '@/routes/equipment';
import {
    destroy as destroyItem,
    store as storeItem,
    update as updateItem,
} from '@/routes/equipment-checklist-items';
import {
    makeDefault,
    destroy,
    show,
    update,
} from '@/routes/equipment-checklists';
import { showFailure } from '@/lib/optimistic';
import type { EquipmentChecklist, EquipmentChecklistItem } from '@/types';

/**
 * Take a check off the list. A check that has already been looked at asks
 * first, since whatever was found goes with it.
 */
function RemoveCheck({ item }: { item: EquipmentChecklistItem }) {
    const needsConfirming = item.status !== 'pending' || Boolean(item.notes);

    // The check goes straight away, and comes back if the server says no.
    const withoutItem = (props: Record<string, unknown>) => {
        const checklist = props.checklist as EquipmentChecklist;

        return {
            checklist: {
                ...checklist,
                items: checklist.items?.filter(
                    (existing) => existing.id !== item.id,
                ),
            },
        };
    };

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
                          router
                              .optimistic(withoutItem)
                              .delete(destroyItem(item.id).url, {
                                  preserveScroll: true,
                                  showProgress: false,
                                  onError: (errors) => showFailure(errors),
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
            form={destroyItem.form(item.id)}
            optimistic={withoutItem}
        />
    ) : (
        button
    );
}

/**
 * Mark the checklist the equipment's next one is copied from, or let an
 * older one take that back.
 */
function DefaultChecklistToggle({
    checklist,
}: {
    checklist: EquipmentChecklist;
}) {
    if (checklist.is_default) {
        return (
            <span className="bg-primary/10 text-primary inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium">
                <Star className="size-4 fill-current" />
                Default checklist
            </span>
        );
    }

    // It shows as the default straight away, and goes back if the server says no.
    const asDefault = (props: Record<string, unknown>) => ({
        checklist: {
            ...(props.checklist as EquipmentChecklist),
            is_default: true,
        },
    });

    return (
        <Button
            variant="outline"
            onClick={() =>
                router.optimistic(asDefault).put(
                    makeDefault(checklist.id).url,
                    {},
                    {
                        preserveScroll: true,
                        showProgress: false,
                        onError: (errors) => showFailure(errors),
                    },
                )
            }
        >
            <Star />
            Make default
        </Button>
    );
}

/**
 * Add a check to the end of the list.
 */
function AddCheck({ checklistId }: { checklistId: string }) {
    return (
        <Form
            {...storeItem.form(checklistId)}
            options={{ preserveScroll: true }}
            resetOnSuccess
            className="grid gap-2"
        >
            {({ processing, errors }) => (
                <>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            name="label"
                            placeholder="What needs checking"
                            aria-label="New check"
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

export default function EquipmentChecklistShow({
    checklist,
}: {
    checklist: EquipmentChecklist;
}) {
    const equipmentName = checklist.equipment?.name ?? 'Equipment';
    const canEdit = !checklist.is_complete;

    setLayoutProps({
        breadcrumbs: [
            {
                title: equipmentName,
                href: showEquipment(checklist.equipment_id),
            },
            { title: checklist.title, href: show(checklist.id) },
        ],
    });

    const items = checklist.items ?? [];
    const checked = items.filter((item) => item.status !== 'pending');
    const flagged = items.filter((item) => item.status === 'attention');
    const fixed = items.filter((item) => item.status === 'fixed');
    const progress = items.length
        ? Math.round((checked.length / items.length) * 100)
        : 0;

    return (
        <>
            <Head title={checklist.title} />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title={checklist.title}
                    description={equipmentName}
                    actions={
                        <>
                            <DefaultChecklistToggle checklist={checklist} />
                            <Button variant="outline" asChild>
                                <Link
                                    href={showEquipment(checklist.equipment_id)}
                                >
                                    View equipment
                                </Link>
                            </Button>
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
                                form={destroy.form(checklist.id)}
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
                        value={checklist.is_complete ? 'Signed off' : 'Open'}
                        hint={equipmentName}
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
                        <section className="bg-card rounded-xl border">
                            <ul className="divide-y">
                                {items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">
                                                {item.label}
                                            </p>
                                            <NoteInput
                                                url={updateItem(item.id).url}
                                                notes={item.notes}
                                                label={item.label}
                                            />
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <EquipmentCheckStatusButtons
                                                item={item}
                                                disabled={checklist.is_complete}
                                            />
                                            {canEdit && (
                                                <RemoveCheck item={item} />
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {canEdit && (
                                <div className="border-t px-5 py-3">
                                    <AddCheck checklistId={checklist.id} />
                                </div>
                            )}

                            {checklist.is_default && (
                                <p className="text-muted-foreground border-t px-5 py-3 text-sm">
                                    The next checklist on {equipmentName} starts
                                    with these checks
                                    {canEdit
                                        ? ', so any you add or take off here carry forward.'
                                        : '.'}
                                </p>
                            )}
                        </section>
                    </div>

                    <aside className="bg-card h-fit rounded-xl border p-6">
                        <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
                            Sign off
                        </h2>

                        <Form
                            {...update.form(checklist.id)}
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
                                            defaultValue={checklist.notes ?? ''}
                                            placeholder="Anything worth knowing."
                                        />
                                    </div>

                                    <input
                                        type="hidden"
                                        name="completed"
                                        value={
                                            checklist.is_complete ? '0' : '1'
                                        }
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        variant={
                                            checklist.is_complete
                                                ? 'outline'
                                                : 'default'
                                        }
                                        disabled={processing}
                                    >
                                        {checklist.is_complete
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
