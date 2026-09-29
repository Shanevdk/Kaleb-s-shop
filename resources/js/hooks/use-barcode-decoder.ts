import { useHttp } from '@inertiajs/react';
import { decode } from '@/routes/receiving';
import type { DecodedBarcode } from '@/types';

/**
 * Turn a scanned code into a description: the part it is already on, or what
 * the public barcode database calls it.
 */
export function useBarcodeDecoder() {
    const decoder = useHttp<{ barcode: string }, DecodedBarcode>({
        barcode: '',
    });

    const decodeBarcode = (barcode: string): Promise<DecodedBarcode> => {
        decoder.transform(() => ({ barcode }));

        return decoder.get(decode.url());
    };

    return { decodeBarcode, decoding: decoder.processing };
}
