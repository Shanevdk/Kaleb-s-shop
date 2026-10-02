import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';

/**
 * The longest note the server keeps.
 */
const MAX_LENGTH = 255;

/**
 * A note field on a checklist item that saves itself shortly after typing
 * stops, and straight away on blur or if the page is left before then — so a
 * quick click away doesn't drop what was just typed. Only the note is sent,
 * so it can never undo a status clicked at the same moment, and the save
 * runs alongside other requests rather than being cancelled by them. A note
 * only counts as saved once the server says so; if it is turned down, the
 * reason shows and the next change tries again.
 */
export default function NoteInput({
    url,
    notes,
    label,
}: {
    url: string;
    notes: string | null;
    label: string;
}) {
    const [value, setValue] = useState(notes ?? '');
    const [error, setError] = useState<string | null>(null);
    const valueRef = useRef(value);
    const urlRef = useRef(url);
    const savedRef = useRef(notes ?? '');
    const sentRef = useRef(notes ?? '');
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    valueRef.current = value;
    urlRef.current = url;

    const flush = () => {
        clearTimeout(timeoutRef.current);

        const note = valueRef.current;

        // Compared with what was last sent, not last saved, so typing back
        // to the old text while a save is on its way still sends it.
        if (note === sentRef.current) {
            return;
        }

        sentRef.current = note;

        router.patch(
            urlRef.current,
            { notes: note },
            {
                async: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    savedRef.current = note;
                    setError(null);
                },
                onError: (errors) => {
                    sentRef.current = savedRef.current;
                    setError(errors.notes ?? 'The note could not be saved.');
                },
            },
        );
    };

    useEffect(() => {
        return flush;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <Input
                value={value}
                maxLength={MAX_LENGTH}
                placeholder="Add a note"
                aria-label={`Note for ${label}`}
                aria-invalid={error !== null}
                className="mt-2 h-8 border-0 border-b border-dashed px-0 text-sm shadow-none focus-visible:ring-0"
                onChange={(event) => {
                    setValue(event.target.value);
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(flush, 800);
                }}
                onBlur={flush}
            />
            <InputError message={error ?? undefined} className="mt-1" />
        </>
    );
}
