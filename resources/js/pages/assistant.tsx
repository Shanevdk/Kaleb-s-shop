import { Head, useHttp } from '@inertiajs/react';
import { Bot, KeyRound, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ask } from '@/actions/App/Http/Controllers/AssistantController';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
    'What parts are low on stock?',
    'Which jobs are still open?',
    'What has been flagged on the checklists?',
    'How much have we spent this month?',
];

/** The server only takes this many turns of history. */
const MAX_TURNS = 40;

type Message = {
    id: number;
    role: 'user' | 'assistant';
    text: string;
};

type Turn = { role: Message['role']; content: string };

type AskResponse = { reply: string; model: string | null };

export default function Assistant({ isConfigured }: { isConfigured: boolean }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);

    const http = useHttp<{ messages: Turn[] }, AskResponse>({ messages: [] });

    const nextId = useRef(0);
    const bottom = useRef<HTMLDivElement>(null);

    const isBusy = http.processing;
    const canRetry =
        error !== null && messages[messages.length - 1]?.role === 'user';

    /**
     * Send the conversation so far and add the answer to it.
     */
    function send(history: Message[]): void {
        setError(null);

        http.transform(() => ({
            messages: history
                .slice(-MAX_TURNS)
                .map(({ role, text }) => ({ role, content: text })),
        }));

        http.post(ask.url(), {
            onError: (errors) => {
                setError(
                    Object.values(errors)[0] ??
                        'That question could not be sent.',
                );
            },
            onHttpException: (response) => {
                setError(
                    messageFrom(response.data) ??
                        'The assistant could not answer just now. Try again in a moment.',
                );

                return false;
            },
            onNetworkError: () => {
                setError('Could not reach the server. Check the connection.');

                return false;
            },
        })
            .then((response) => {
                if (!response?.reply) {
                    return;
                }

                setMessages((current) => [
                    ...current,
                    {
                        id: nextId.current++,
                        role: 'assistant',
                        text: response.reply,
                    },
                ]);
            })
            .catch(() => {
                // Already shown through the handlers above.
            });
    }

    function askQuestion(question: string): void {
        const trimmed = question.trim();

        if (trimmed === '' || isBusy || !isConfigured) {
            return;
        }

        const history: Message[] = [
            ...messages,
            { id: nextId.current++, role: 'user', text: trimmed },
        ];

        setMessages(history);
        setDraft('');
        send(history);
    }

    function startOver(): void {
        http.cancel();
        setMessages([]);
        setError(null);
    }

    useEffect(() => {
        bottom.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isBusy, error]);

    return (
        <>
            <Head title="Assistant" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Assistant"
                    description="Ask about the fleet, jobs, checklists and parts. It looks up your records to answer."
                    actions={
                        messages.length > 0 ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={startOver}
                            >
                                <RotateCcw />
                                New chat
                            </Button>
                        ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                                <Sparkles className="size-3.5" />
                                AI assistant
                            </span>
                        )
                    }
                />

                <div className="flex flex-1 flex-col gap-4">
                    <div className="flex-1 space-y-6">
                        {!isConfigured && <NotConfigured />}

                        {isConfigured && messages.length === 0 && (
                            <div className="flex flex-col items-center gap-4 py-12 text-center">
                                <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                                    <Bot className="size-6" />
                                </span>
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        How can I help in the shop today?
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        I can look up vehicles, jobs, checklists
                                        and stock, work out costs and answer
                                        general mechanical questions.
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {SUGGESTIONS.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() =>
                                                askQuestion(suggestion)
                                            }
                                            className="hover:bg-accent rounded-full border px-3 py-1.5 text-sm transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <Bubble key={message.id} role={message.role}>
                                {message.role === 'assistant'
                                    ? withBold(message.text)
                                    : message.text}
                            </Bubble>
                        ))}

                        {isBusy && (
                            <Bubble role="assistant">
                                <TypingDots />
                            </Bubble>
                        )}

                        {error !== null && (
                            <div
                                role="alert"
                                className="border-destructive/40 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
                            >
                                <span>{error}</span>
                                {canRetry && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => send(messages)}
                                        disabled={isBusy}
                                    >
                                        Try again
                                    </Button>
                                )}
                            </div>
                        )}

                        <div ref={bottom} />
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            askQuestion(draft);
                        }}
                        className="bg-background sticky bottom-0 flex items-end gap-2 border-t pt-4"
                    >
                        <Textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    askQuestion(draft);
                                }
                            }}
                            placeholder={
                                isConfigured
                                    ? 'Ask the assistant…'
                                    : 'The assistant is not set up yet'
                            }
                            disabled={!isConfigured}
                            maxLength={4000}
                            rows={1}
                            className="max-h-40 min-h-11 resize-none"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="size-11 shrink-0"
                            disabled={
                                !isConfigured || isBusy || draft.trim() === ''
                            }
                        >
                            <Send />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>

                    <p className="text-muted-foreground text-center text-xs">
                        The assistant can make mistakes. Check anything that
                        matters against the records.
                    </p>
                </div>
            </div>
        </>
    );
}

/**
 * Show **bold** the way the models like to write it, rather than as literal
 * asterisks. Everything else stays plain text.
 */
function withBold(text: string): React.ReactNode[] {
    return text
        .split(/\*\*(.+?)\*\*/g)
        .map((part, index) =>
            index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
        );
}

/**
 * Pull the message out of an error response body, if it has one.
 */
function messageFrom(data: unknown): string | null {
    try {
        const body = typeof data === 'string' ? JSON.parse(data) : data;

        return typeof body?.message === 'string' ? body.message : null;
    } catch {
        return null;
    }
}

function NotConfigured() {
    return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                <KeyRound className="size-6" />
            </span>
            <p className="font-medium">The assistant is not set up yet</p>
            <p className="text-muted-foreground max-w-md text-sm">
                Add an OpenRouter API key as{' '}
                <code className="bg-muted rounded px-1">
                    OPENROUTER_API_KEY
                </code>{' '}
                in the environment settings, then reload this page.
            </p>
        </div>
    );
}

function Bubble({
    role,
    children,
}: {
    role: Message['role'];
    children: React.ReactNode;
}) {
    const isUser = role === 'user';

    return (
        <div
            className={cn('flex gap-3', isUser && 'flex-row-reverse')}
            role={isUser ? undefined : 'status'}
        >
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
            >
                {isUser ? (
                    <User className="size-4" />
                ) : (
                    <Bot className="size-4" />
                )}
            </span>
            <div
                className={cn(
                    'max-w-[80ch] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
            >
                {children}
            </div>
        </div>
    );
}

function TypingDots() {
    return (
        <span className="flex items-center gap-1 py-1">
            {[0, 150, 300].map((delay) => (
                <span
                    key={delay}
                    className="bg-muted-foreground size-1.5 animate-bounce rounded-full"
                    style={{ animationDelay: `${delay}ms` }}
                />
            ))}
            <span className="sr-only">Thinking</span>
        </span>
    );
}
