import { Form, Head, Link } from '@inertiajs/react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { create, index } from '@/routes/admin/users';
import type { RoleOption } from '@/types';

export default function AdminUserCreate({ roles }: { roles: RoleOption[] }) {
    return (
        <>
            <Head title="Add someone" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Add someone to the shop"
                    description="They can sign in straight away with the password you set here."
                />

                <div className="bg-card max-w-2xl rounded-xl border p-6">
                    <Form
                        {...UserController.store.form()}
                        className="space-y-6"
                        resetOnSuccess={['password', 'password_confirmation']}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="Kaleb Van De Krol"
                                        required
                                        autoFocus
                                        autoComplete="name"
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        required
                                        autoComplete="off"
                                    />
                                    <InputError message={errors.email} />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">
                                            Password
                                        </Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            required
                                            autoComplete="new-password"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">
                                            Confirm password
                                        </Label>
                                        <Input
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            type="password"
                                            required
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>

                                <p className="text-muted-foreground text-sm">
                                    Tell them the password yourself — no email
                                    is sent. They can change it later under
                                    Settings.
                                </p>

                                <fieldset className="grid gap-2">
                                    <legend className="mb-2 text-sm font-medium">
                                        What can they do?
                                    </legend>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {roles.map((role) => (
                                            <label
                                                key={role.value}
                                                className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors"
                                            >
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={role.value}
                                                    defaultChecked={
                                                        role.value ===
                                                        'mechanic'
                                                    }
                                                    className="accent-primary mt-1"
                                                />
                                                <span className="grid gap-1">
                                                    <span className="text-sm font-medium">
                                                        {role.label}
                                                    </span>
                                                    <span className="text-muted-foreground text-sm">
                                                        {role.description}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <InputError message={errors.role} />
                                </fieldset>

                                <div className="flex items-center gap-3 border-t pt-6">
                                    <Button type="submit" disabled={processing}>
                                        Add to the shop
                                    </Button>
                                    <Button variant="ghost" asChild>
                                        <Link href={index()}>Cancel</Link>
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            </div>
        </>
    );
}

AdminUserCreate.layout = {
    breadcrumbs: [
        { title: 'Team', href: index() },
        { title: 'Add someone', href: create() },
    ],
};
