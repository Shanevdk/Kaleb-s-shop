import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    MailWarning,
    Plus,
    ShieldCheck,
    SlidersHorizontal,
    Trash2,
    UserRound,
} from 'lucide-react';
import DeleteConfirm from '@/components/delete-confirm';
import PageHeader from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { create, destroy, index, update, verify } from '@/routes/admin/users';
import { update as updatePermissions } from '@/routes/admin/users/permissions';
import type {
    Permission,
    PermissionOption,
    RoleOption,
    TeamMember,
} from '@/types';

export default function AdminUsersIndex({
    users,
    roles,
    permissionOptions,
}: {
    users: TeamMember[];
    roles: RoleOption[];
    permissionOptions: PermissionOption[];
}) {
    const changeRole = (user: TeamMember, role: string) => {
        router.patch(update(user.id).url, { role }, { preserveScroll: true });
    };

    // Tracks the permissions each account is mid-save with, so a second
    // toggle fired before the first request lands builds on top of it
    // instead of the stale set the page loaded with.
    const [pendingPermissions, setPendingPermissions] = useState<
        Record<string, Permission[]>
    >({});

    const togglePermission = (
        user: TeamMember,
        permission: Permission,
        granted: boolean,
    ) => {
        const current = pendingPermissions[user.id] ?? user.permissions;
        const next = granted
            ? [...current, permission]
            : current.filter((p) => p !== permission);

        setPendingPermissions((state) => ({ ...state, [user.id]: next }));

        router.patch(
            updatePermissions(user.id).url,
            { permissions: next },
            {
                preserveScroll: true,
                onFinish: () =>
                    setPendingPermissions(({ [user.id]: _, ...rest }) => rest),
            },
        );
    };

    const verifyUser = (user: TeamMember) => {
        router.post(verify(user.id).url, {}, { preserveScroll: true });
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
                                <TableHead>Permissions</TableHead>
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
                                        <span className="flex flex-wrap items-center gap-2">
                                            {user.is_current_user ? (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1"
                                                >
                                                    {user.role === 'admin' && (
                                                        <ShieldCheck className="size-3" />
                                                    )}
                                                    {user.role_label}
                                                </Badge>
                                            ) : (
                                                <Select
                                                    value={user.role}
                                                    onValueChange={(role) =>
                                                        changeRole(user, role)
                                                    }
                                                >
                                                    <SelectTrigger
                                                        className="h-8 w-40"
                                                        aria-label={`Role for ${user.name}`}
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {roles.map((role) => (
                                                            <SelectItem
                                                                key={role.value}
                                                                value={
                                                                    role.value
                                                                }
                                                            >
                                                                {role.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {!user.is_verified && (
                                                <Badge className="gap-1 border-transparent bg-amber-500 text-amber-950">
                                                    <MailWarning className="size-3" />
                                                    Cannot sign in
                                                </Badge>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const permissions =
                                                pendingPermissions[user.id] ??
                                                user.permissions;
                                            const defaultPermissions =
                                                roles.find(
                                                    (role) =>
                                                        role.value ===
                                                        user.role,
                                                )?.default_permissions ?? [];
                                            const extraCount =
                                                permissions.length;

                                            return (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1"
                                                            aria-label={`Permissions for ${user.name}`}
                                                        >
                                                            <SlidersHorizontal className="size-3.5" />
                                                            {extraCount > 0
                                                                ? `+${extraCount} extra`
                                                                : 'Permissions'}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuLabel>
                                                            Extra permissions
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {permissionOptions.map(
                                                            (permission) => {
                                                                const fromRole =
                                                                    defaultPermissions.includes(
                                                                        permission.value,
                                                                    );
                                                                const granted =
                                                                    fromRole ||
                                                                    permissions.includes(
                                                                        permission.value,
                                                                    );

                                                                return (
                                                                    <DropdownMenuCheckboxItem
                                                                        key={
                                                                            permission.value
                                                                        }
                                                                        checked={
                                                                            granted
                                                                        }
                                                                        disabled={
                                                                            fromRole
                                                                        }
                                                                        onCheckedChange={(
                                                                            checked,
                                                                        ) =>
                                                                            togglePermission(
                                                                                user,
                                                                                permission.value,
                                                                                checked,
                                                                            )
                                                                        }
                                                                        onSelect={(
                                                                            event,
                                                                        ) =>
                                                                            event.preventDefault()
                                                                        }
                                                                    >
                                                                        {
                                                                            permission.label
                                                                        }
                                                                        {fromRole && (
                                                                            <span className="text-muted-foreground ml-auto text-xs">
                                                                                from
                                                                                role
                                                                            </span>
                                                                        )}
                                                                    </DropdownMenuCheckboxItem>
                                                                );
                                                            },
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(
                                            user.created_at?.slice(0, 10),
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!user.is_current_user && (
                                            <span className="flex items-center justify-end gap-2">
                                                {!user.is_verified && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            verifyUser(user)
                                                        }
                                                    >
                                                        Let them in
                                                    </Button>
                                                )}
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
                                                    description="They lose access immediately. Anything they logged stays with the shop."
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
