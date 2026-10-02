import { Form } from '@inertiajs/react';
import {
    Banknote,
    Check,
    Clock,
    Copy,
    ExternalLink,
    RotateCcw,
    Share2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import DeleteConfirm from '@/components/delete-confirm';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useClipboard } from '@/hooks/use-clipboard';
import { describeCost, describeTime } from '@/lib/work-order';
import { update } from '@/routes/service-records/work-order';
import type { WorkOrder } from '@/types';

/**
 * Write up what is wrong with a job, then email the work order, copy its
 * link or open it to print. The cost and time are worked out automatically:
 * the parts at stock prices, or the AI's estimate for parts not on the
 * shelf, and the AI's estimate of the repair time. The link needs no login
 * and always shows the job as it is now.
 */
export default function WorkOrderDialog({
    recordId,
    sheet,
    url,
    trigger,
}: {
    recordId: string;
    sheet: WorkOrder;
    url: string;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [copiedText, copy] = useClipboard();
    const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
    const cost = describeCost(sheet);
    const time = describeTime(sheet);

    const share = () => {
        navigator
            .share({ title: `Work order: ${sheet.title}`, url })
            .catch(() => {});
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogTitle>Work order</DialogTitle>
                <DialogDescription>
                    Say what is wrong. The cost and repair time are worked out
                    automatically from the parts and the AI estimate.
                </DialogDescription>

                <div className="grid grid-cols-2 gap-3">
                    <Figure
                        icon={Banknote}
                        label="Estimated cost"
                        value={cost.value}
                        hint={cost.hint}
                    />
                    <Figure
                        icon={Clock}
                        label="Repair time"
                        value={time.value}
                        hint={time.hint}
                    />
                </div>

                <Form
                    {...update.form(recordId)}
                    options={{ preserveScroll: true }}
                    onSuccess={() => {
                        setEmail('');
                        setOpen(false);
                    }}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="issue_reason">
                                    What's wrong, and why it needs doing
                                </Label>
                                <Textarea
                                    id="issue_reason"
                                    name="issue_reason"
                                    defaultValue={sheet.reason}
                                    rows={5}
                                    maxLength={5000}
                                    required
                                />
                                <InputError message={errors.issue_reason} />
                            </div>

                            <div className="grid gap-2 border-t pt-4">
                                <Label htmlFor="issue_email">
                                    Email it to (optional)
                                </Label>
                                <Input
                                    id="issue_email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                />
                                <InputError message={errors.email} />
                            </div>

                            {email.trim() !== '' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="issue_message">
                                        Message (optional)
                                    </Label>
                                    <Textarea
                                        id="issue_message"
                                        name="message"
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Here's what we found…"
                                    />
                                    <InputError message={errors.message} />
                                </div>
                            )}

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {email.trim() === ''
                                        ? 'Save'
                                        : 'Save and email'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>

                <div className="space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs">
                        Or share the link yourself. It shows what was last
                        saved.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copy(url)}
                        >
                            {copiedText === url ? <Check /> : <Copy />}
                            {copiedText === url ? 'Copied' : 'Copy link'}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={url} target="_blank" rel="noreferrer">
                                <ExternalLink />
                                Open / print
                            </a>
                        </Button>
                        {canShare && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={share}
                            >
                                <Share2 />
                                Share
                            </Button>
                        )}
                        <DeleteConfirm
                            trigger={
                                <Button type="button" variant="ghost" size="sm">
                                    <RotateCcw />
                                    Reset link
                                </Button>
                            }
                            title="Reset the work order link?"
                            description="Every link already shared or emailed for this job stops opening. You get a new link to share."
                            confirmLabel="Reset link"
                            form={update.form(recordId, {
                                query: { reset_link: 1 },
                            })}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Figure({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint: string | null;
}) {
    return (
        <div className="bg-muted/50 rounded-lg border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <Icon className="size-3.5" />
                {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            {hint && (
                <p className="text-muted-foreground text-xs">{hint}</p>
            )}
        </div>
    );
}
