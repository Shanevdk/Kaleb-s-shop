import type { LucideIcon } from 'lucide-react';

export default function StatCard({
    label,
    value,
    hint,
    icon: Icon,
}: {
    label: string;
    value: string;
    hint?: string;
    icon: LucideIcon;
}) {
    return (
        <div className="bg-card relative overflow-hidden rounded-xl border p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                        {label}
                    </p>
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </p>
                    {hint && (
                        <p className="text-muted-foreground text-xs">{hint}</p>
                    )}
                </div>
                <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                    <Icon className="size-4.5" />
                </span>
            </div>
        </div>
    );
}
