import { router } from '@inertiajs/react';
import { AlertTriangle, Check, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { update } from '@/routes/inspection-items';
import type { CheckStatus, InspectionItem } from '@/types';

const choices: {
    status: Exclude<CheckStatus, 'pending'>;
    label: string;
    icon: LucideIcon;
    active: string;
}[] = [
    {
        status: 'good',
        label: 'Good',
        icon: Check,
        active: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950',
    },
    {
        status: 'attention',
        label: 'Needs attention',
        icon: AlertTriangle,
        active: 'border-amber-500 bg-amber-500 text-amber-950',
    },
    {
        status: 'fixed',
        label: 'Fixed',
        icon: Wrench,
        active: 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-sky-950',
    },
];

export default function CheckStatusButtons({
    item,
    disabled = false,
}: {
    item: InspectionItem;
    disabled?: boolean;
}) {
    const setStatus = (status: CheckStatus) => {
        router.patch(
            update(item.id).url,
            { status: status === item.status ? 'pending' : status },
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <div className="flex shrink-0 items-center gap-1">
            {choices.map((choice) => {
                const Icon = choice.icon;
                const isActive = item.status === choice.status;

                return (
                    <button
                        key={choice.status}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isActive}
                        aria-label={`${choice.label}: ${item.label}`}
                        title={choice.label}
                        onClick={() => setStatus(choice.status)}
                        className={cn(
                            'flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50',
                            isActive
                                ? choice.active
                                : 'text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4 shrink-0" />
                        <span className="hidden sm:inline">{choice.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
