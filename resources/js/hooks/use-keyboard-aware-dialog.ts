import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Keep an open dialog inside the part of a phone's screen the on-screen
 * keyboard leaves visible: pinned to the top of it, and no taller than it,
 * so it scrolls instead of sliding under the keys. Wider screens get no
 * style back and keep the dialog centred.
 */
export function useKeyboardAwareDialog(
    open: boolean,
): CSSProperties | undefined {
    const [style, setStyle] = useState<CSSProperties | undefined>();

    useEffect(() => {
        const viewport = window.visualViewport;

        if (!open || !viewport) {
            return;
        }

        const phone = window.matchMedia('(max-width: 639px)');

        const fit = () =>
            setStyle(
                phone.matches
                    ? {
                          top: viewport.offsetTop + 16,
                          maxHeight: viewport.height - 32,
                      }
                    : undefined,
            );

        fit();
        viewport.addEventListener('resize', fit);
        viewport.addEventListener('scroll', fit);
        phone.addEventListener('change', fit);

        return () => {
            viewport.removeEventListener('resize', fit);
            viewport.removeEventListener('scroll', fit);
            phone.removeEventListener('change', fit);
            setStyle(undefined);
        };
    }, [open]);

    return style;
}
