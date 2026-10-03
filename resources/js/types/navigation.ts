import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    /** A count shown beside the link, such as how many things wait on it. */
    badge?: number;
};

/** A collapsible sidebar heading that holds related links. */
export type NavGroup = {
    title: string;
    icon?: LucideIcon | null;
    items: NavItem[];
};

export type NavEntry = NavItem | NavGroup;
