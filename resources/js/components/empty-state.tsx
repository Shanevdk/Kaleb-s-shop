import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                <Icon className="size-5" />
            </span>
            <div className="space-y-1">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                    {description}
                </p>
            </div>
            {action}
        </div>
    );
}
