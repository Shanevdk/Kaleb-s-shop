import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import PageSkeleton from '@/components/page-skeleton';
import ScreenSaver from '@/components/screen-saver';
import { usePageLoading } from '@/hooks/use-page-loading';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const isLoading = usePageLoading();

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {/* The page stays mounted under the skeleton, so going nowhere keeps its state. */}
                <div className={isLoading ? 'hidden' : 'contents'}>
                    {children}
                </div>
                {isLoading && <PageSkeleton />}
            </AppContent>
            <ScreenSaver />
        </AppShell>
    );
}
