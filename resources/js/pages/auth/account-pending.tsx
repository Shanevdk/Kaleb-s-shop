import { Head, router } from '@inertiajs/react';
import { Clock, XCircle } from 'lucide-react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes';

type Props = {
    status: 'pending' | 'declined';
};

export default function AccountPending({ status }: Props) {
    const isDeclined = status === 'declined';

    return (
        <>
            <Head
                title={isDeclined ? 'Request declined' : 'Waiting for approval'}
            />

            <div className="space-y-6 text-center">
                <div className="text-muted-foreground flex flex-col items-center gap-3 text-sm">
                    {isDeclined ? (
                        <>
                            <XCircle className="text-destructive size-10" />
                            <p>
                                The shop owner declined your request for an
                                account. If you think that is a mistake, talk to
                                them directly.
                            </p>
                        </>
                    ) : (
                        <>
                            <Clock className="size-10 text-amber-500" />
                            <p>
                                Your account has been created, but the shop
                                owner still has to accept it. Check back once
                                they have.
                            </p>
                        </>
                    )}
                </div>

                {!isDeclined && (
                    <Button variant="secondary" onClick={() => router.reload()}>
                        Check again
                    </Button>
                )}

                <TextLink href={logout()} className="mx-auto block text-sm">
                    Log out
                </TextLink>
            </div>
        </>
    );
}

AccountPending.layout = {
    title: 'Account requested',
    description: 'You cannot use anything until the shop owner lets you in.',
};
