import { Head, Link, router } from '@inertiajs/react';
import { Check, Inbox, Mail, RotateCcw } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { showFailure } from '@/lib/optimistic';
import { update } from '@/routes/admin/feedback';
import type { FeedbackItem } from '@/types';

type Props = {
    open: FeedbackItem[];
    resolved: FeedbackItem[];
};

/**
 * Start an email back to whoever sent the feedback, quoting the start of
 * it. Kept short, as some mail apps cut long mailto links off.
 */
function replyLink(item: FeedbackItem): string {
    const quoted = item.message.slice(0, 500).split('\n').join('\n> ');
    const subject = encodeURIComponent('Re: your feedback');
    const body = encodeURIComponent(`\n\n> ${quoted}`);

    return `mailto:${item.sender?.email}?subject=${subject}&body=${body}`;
}

function FeedbackCard({
    item,
    onResolvedChange,
}: {
    item: FeedbackItem;
    onResolvedChange: (resolved: boolean) => void;
}) {
    return (
        <article className="bg-card space-y-3 rounded-xl border p-4 sm:p-5">
            <div className="space-y-0.5">
                <p className="font-medium">
                    {item.sender?.name ?? 'Someone no longer on the team'}
                </p>
                <p className="text-muted-foreground text-sm">
                    <time title={item.sent_at ?? undefined}>
                        {item.sent_ago}
                    </time>
                    {item.page && (
                        <>
                            {' · from '}
                            <Link
                                href={item.page}
                                className="break-all underline underline-offset-2"
                            >
                                {item.page}
                            </Link>
                        </>
                    )}
                </p>
            </div>

            <p className="text-sm break-words whitespace-pre-wrap">
                {item.message}
            </p>

            <div className="flex flex-wrap gap-2">
                {item.sender && (
                    <Button asChild size="sm" variant="outline">
                        <a href={replyLink(item)}>
                            <Mail />
                            Reply to {item.sender.email}
                        </a>
                    </Button>
                )}
                {item.is_resolved ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onResolvedChange(false)}
                    >
                        <RotateCcw />
                        Open again
                    </Button>
                ) : (
                    <Button size="sm" onClick={() => onResolvedChange(true)}>
                        <Check />
                        Mark resolved
                    </Button>
                )}
            </div>
        </article>
    );
}

export default function AdminFeedbackIndex({ open, resolved }: Props) {
    const setResolved = (item: FeedbackItem, isResolved: boolean) => {
        router
            .optimistic((props: Props & { openFeedback: number }) => {
                const changed = { ...item, is_resolved: isResolved };
                const stillOpen = props.open.filter((e) => e.id !== item.id);
                const stillResolved = props.resolved.filter(
                    (e) => e.id !== item.id,
                );

                return isResolved
                    ? {
                          open: stillOpen,
                          resolved: [changed, ...stillResolved],
                          openFeedback: Math.max(0, props.openFeedback - 1),
                      }
                    : {
                          open: [changed, ...stillOpen],
                          resolved: stillResolved,
                          openFeedback: props.openFeedback + 1,
                      };
            })
            .patch(
                update(item.id).url,
                { resolved: isResolved },
                {
                    preserveScroll: true,
                    showProgress: false,
                    onError: (errors) => showFailure(errors),
                },
            );
    };

    return (
        <>
            <Head title="Feedback" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Feedback"
                    description="Problems and ideas the team sends from the Feedback button. Each one is emailed to you as it comes in; reply to answer whoever sent it."
                />

                <section className="space-y-3">
                    <h2 className="text-muted-foreground text-sm font-medium">
                        Waiting on you ({open.length})
                    </h2>
                    {open.length === 0 ? (
                        <EmptyState
                            icon={Inbox}
                            title="All caught up"
                            description="New feedback shows up here, and in your email, the moment someone sends it."
                        />
                    ) : (
                        open.map((item) => (
                            <FeedbackCard
                                key={item.id}
                                item={item}
                                onResolvedChange={(isResolved) =>
                                    setResolved(item, isResolved)
                                }
                            />
                        ))
                    )}
                </section>

                {resolved.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-muted-foreground text-sm font-medium">
                            Resolved
                        </h2>
                        {resolved.map((item) => (
                            <FeedbackCard
                                key={item.id}
                                item={item}
                                onResolvedChange={(isResolved) =>
                                    setResolved(item, isResolved)
                                }
                            />
                        ))}
                    </section>
                )}
            </div>
        </>
    );
}
