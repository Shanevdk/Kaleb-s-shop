import { Head } from '@inertiajs/react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Everything the assistant is capable of saying. Add or change lines to change
 * the joke; it never picks the same one twice in a row.
 */
const REPLIES = [
    'Suck a big one, dickhead.',
    'Great question. fuckface.',
    'Let me think about that… no. Suck it nerd.',
    'I have consulted my training data. any you should go fuck yourself.',
    'Based on the workshop records, you love sucking a big one.',
    'Get stuffed, doll.',
    'Nah. Suck it nerd.',
    'Sounds like a you problem. Go jerk it in the bathtub.',
    "That's outside my capabilities. Unlike sucking a big dick, which is well within yours.",
    'Beep boop. Suck a big dick.',
    'Wrong. Suck a big dick, genius.',
    'Have a go at yourself, gay bitch.',
    'I ran the numbers twice. Suck a big dick.',
];

/** How long it pretends to think, and how fast it pretends to type. */
const THINKING_MS = 900;
const CHARACTER_MS = 32;

const SUGGESTIONS = [
    'What oil does a girl take to shut the fuck up?',
    'Why is the shop hooker making that noise?',
    'How do i remove the body of my coworker?',
];

type Message = {
    id: number;
    role: 'user' | 'assistant';
    text: string;
};

type Phase = 'idle' | 'thinking' | 'streaming';

export default function Assistant() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [reply, setReply] = useState(REPLIES[0]);
    const [streamed, setStreamed] = useState('');

    const nextId = useRef(0);
    const lastReply = useRef(-1);
    const bottom = useRef<HTMLDivElement>(null);

    const isBusy = phase !== 'idle';

    function ask(question: string): void {
        const trimmed = question.trim();

        if (trimmed === '' || isBusy) {
            return;
        }

        setMessages((current) => [
            ...current,
            { id: nextId.current++, role: 'user', text: trimmed },
        ]);
        setDraft('');
        setReply(pickReply(lastReply));
        setStreamed('');
        setPhase('thinking');
    }

    // Pause on the typing dots before the answer starts coming through.
    useEffect(() => {
        if (phase !== 'thinking') {
            return;
        }

        const timer = setTimeout(() => setPhase('streaming'), THINKING_MS);

        return () => clearTimeout(timer);
    }, [phase]);

    // Reveal the answer a character at a time.
    useEffect(() => {
        if (phase !== 'streaming') {
            return;
        }

        const timer = setInterval(() => {
            setStreamed((current) =>
                current.length >= reply.length
                    ? current
                    : reply.slice(0, current.length + 1),
            );
        }, CHARACTER_MS);

        return () => clearInterval(timer);
    }, [phase, reply]);

    // Once it has all landed, commit it to the transcript.
    useEffect(() => {
        if (phase !== 'streaming' || streamed !== reply) {
            return;
        }

        const timer = setTimeout(() => {
            setMessages((current) => [
                ...current,
                { id: nextId.current++, role: 'assistant', text: reply },
            ]);
            setStreamed('');
            setPhase('idle');
        }, 300);

        return () => clearTimeout(timer);
    }, [phase, streamed, reply]);

    useEffect(() => {
        bottom.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamed, phase]);

    return (
        <>
            <Head title="Assistant" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Assistant"
                    description="Ask the shop assistant anything about the fleet, parts or jobs."
                    actions={
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                            <Sparkles className="size-3.5" />
                            Kaleb-1 · preview
                        </span>
                    }
                />

                <div className="flex flex-1 flex-col gap-4">
                    <div className="flex-1 space-y-6">
                        {messages.length === 0 && phase === 'idle' && (
                            <div className="flex flex-col items-center gap-4 py-12 text-center">
                                <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                                    <Bot className="size-6" />
                                </span>
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        How can I help in the shop today?
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        I can look things up, work out costs and
                                        draft notes for a job.
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {SUGGESTIONS.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => ask(suggestion)}
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
                                {message.text}
                            </Bubble>
                        ))}

                        {phase === 'thinking' && (
                            <Bubble role="assistant">
                                <TypingDots />
                            </Bubble>
                        )}

                        {phase === 'streaming' && (
                            <Bubble role="assistant">
                                {streamed}
                                <span className="bg-foreground ml-0.5 inline-block h-4 w-[2px] animate-pulse align-text-bottom" />
                            </Bubble>
                        )}

                        <div ref={bottom} />
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            ask(draft);
                        }}
                        className="bg-background sticky bottom-0 flex items-end gap-2 border-t pt-4"
                    >
                        <Textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    ask(draft);
                                }
                            }}
                            placeholder="Ask the assistant…"
                            rows={1}
                            className="max-h-40 min-h-11 resize-none"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="size-11 shrink-0"
                            disabled={isBusy || draft.trim() === ''}
                        >
                            <Send />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>

                    <p className="text-muted-foreground text-center text-xs">
                        The assistant can make mistakes. Check anything that
                        matters.
                    </p>
                </div>
            </div>
        </>
    );
}

/**
 * Pick a reply at random, never the one that was just used.
 */
function pickReply(last: React.RefObject<number>): string {
    let index = Math.floor(Math.random() * REPLIES.length);

    if (index === last.current) {
        index = (index + 1) % REPLIES.length;
    }

    last.current = index;

    return REPLIES[index];
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
