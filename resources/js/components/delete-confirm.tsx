import { Form } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { showFailure } from '@/lib/optimistic';

type FormAction = {
    action: string;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
};

/**
 * Ask before deleting something. Given how the page looks without it, the
 * thing goes straight away and comes back if the delete is turned down.
 * Either way, whatever the server says went wrong is shown.
 */
export default function DeleteConfirm({
    trigger,
    title,
    description,
    confirmLabel = 'Delete',
    form,
    optimistic,
}: {
    trigger: ReactNode;
    title: string;
    description: string;
    confirmLabel?: string;
    form: FormAction;
    /** The page's props as they look once it is gone. */
    optimistic?: (props: Record<string, unknown>) => Record<string, unknown>;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <Form
                    {...form}
                    options={{ preserveScroll: true }}
                    optimistic={optimistic}
                    onError={(errors) =>
                        showFailure(errors, 'That could not be deleted.')
                    }
                >
                    {({ processing }) => (
                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="secondary" type="button">
                                    Cancel
                                </Button>
                            </DialogClose>

                            <Button
                                variant="destructive"
                                type="submit"
                                disabled={processing}
                            >
                                {confirmLabel}
                            </Button>
                        </DialogFooter>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
