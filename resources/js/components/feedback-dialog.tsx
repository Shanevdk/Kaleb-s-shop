import { Form, usePage } from '@inertiajs/react';
import { MessageSquareWarning } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useKeyboardAwareDialog } from '@/hooks/use-keyboard-aware-dialog';
import { store } from '@/routes/feedback';

/**
 * Report a problem or send an idea to the admins from any page. They get
 * an email straight away, along with the page it was sent from, and their
 * reply goes back to the sender's email.
 */
export default function FeedbackDialog() {
    const { props, url } = usePage();
    const [open, setOpen] = useState(false);
    const keyboardAwareStyle = useKeyboardAwareDialog(open);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <MessageSquareWarning />
                    Feedback
                </Button>
            </DialogTrigger>
            <DialogContent
                className="top-4 translate-y-0 overflow-y-auto sm:top-[50%] sm:translate-y-[-50%]"
                style={keyboardAwareStyle}
            >
                <DialogTitle>Report a problem or send feedback</DialogTitle>
                <DialogDescription>
                    It goes to the admins straight away, and they will reply to{' '}
                    {props.auth.user.email}.
                </DialogDescription>

                <Form
                    {...store.form()}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <input type="hidden" name="page" value={url} />

                            <div className="grid gap-2">
                                <Label htmlFor="feedback_message">
                                    What's going on?
                                </Label>
                                <Textarea
                                    id="feedback_message"
                                    name="message"
                                    placeholder="What were you doing, and what went wrong? Or what would make the app better?"
                                    maxLength={5000}
                                    required
                                    autoFocus
                                />
                                <InputError
                                    message={errors.message ?? errors.page}
                                />
                                <p className="text-muted-foreground text-xs">
                                    The page you're on is sent with it.
                                </p>
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Sending…' : 'Send'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
