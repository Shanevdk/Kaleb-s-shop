import { toast } from 'sonner';

/**
 * Say what went wrong after a change that was shown straight away has been
 * turned down by the server, and so put back.
 */
export function showFailure(
    errors: Record<string, string>,
    fallback = 'That did not save, so it has been put back.',
): void {
    toast.error(Object.values(errors)[0] ?? fallback);
}
