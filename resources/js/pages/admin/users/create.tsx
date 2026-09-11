import { Form, Head, Link } from '@inertiajs/react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { create, index } from '@/routes/admin/users';

export default function AdminUserCreate() {
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

                                <div className="flex items-start gap-3 rounded-lg border p-4">
                                    <Checkbox
                                        id="is_admin"
                                        name="is_admin"
                                        value="1"
                                    />
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor="is_admin"
                                            className="font-medium"
                                        >
                                            Make them an administrator
                                        </Label>
                                        <p className="text-muted-foreground text-sm">
                                            Administrators can add and remove
                                            people from the shop.
                                        </p>
                                    </div>
                                </div>

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
