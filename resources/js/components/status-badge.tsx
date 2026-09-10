import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ServiceStatus } from '@/types';

const statusStyles: Record<ServiceStatus, string> = {
    planned:
        'border-neutral-300 bg-transparent text-neutral-600 dark:border-neutral-700 dark:text-neutral-400',
    in_progress:
        'border-neutral-900 bg-transparent text-neutral-900 dark:border-neutral-200 dark:text-neutral-100',
    completed:
        'border-transparent bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
};

export default function StatusBadge({
    status,
    label,
}: {
    status: ServiceStatus;
    label: string;
}) {
    return (
        <Badge
            variant="outline"
            className={cn('font-medium', statusStyles[status])}
        >
            {label}
        </Badge>
    );
}
