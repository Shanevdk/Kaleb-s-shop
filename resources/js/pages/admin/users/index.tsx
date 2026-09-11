import { Head, Link, router } from '@inertiajs/react';
import { Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import PageHeader from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { create, destroy, index, update } from '@/routes/admin/users';
import type { TeamMember } from '@/types';

export default function AdminUsersIndex({ users }: { users: TeamMember[] }) {
    const toggleAdmin = (user: TeamMember) => {
        router.patch(
            update(user.id).url,
            { is_admin: !user.is_admin },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Team" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Team"
                    description="Everyone who can sign in. There is no public sign-up — you add people here."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Add someone
                            </Link>
                        </Button>
                    }
                />

                <div className="bg-card rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Access</TableHead>
                                <TableHead>Added</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <span className="flex items-center gap-2">
                                            <UserRound className="text-muted-foreground size-4" />
                                            {user.name}
                                            {user.is_current_user && (
                                                <span className="text-muted-foreground text-xs">
                                                    (you)
                                                </span>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {user.email}
                                    </TableCell>
                                    <TableCell>
                                        {user.is_admin ? (
                                            <Badge
                                                variant="outline"
                                                className="gap-1"
                                            >
                                                <ShieldCheck className="size-3" />
                                                Administrator
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">
                                                Mechanic
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(
                                            user.created_at?.slice(0, 10),
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!user.is_current_user && (
                                            <span className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        toggleAdmin(user)
                                                    }
                                                >
                                                    {user.is_admin
                                                        ? 'Revoke admin'
                                                        : 'Make admin'}
                                                </Button>
                                                <DeleteConfirm
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove ${user.name}`}
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    }
                                                    title={`Remove ${user.name}?`}
                                                    description="They lose access immediately. Anything they logged stays on their account and is removed with it."
                                                    confirmLabel="Remove access"
                                                    form={destroy.form(user.id)}
                                                />
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}

AdminUsersIndex.layout = {
    breadcrumbs: [{ title: 'Team', href: index() }],
};
