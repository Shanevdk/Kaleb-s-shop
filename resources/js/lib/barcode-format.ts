/**
 * Put a retail barcode the camera read into the one form parts are saved
 * under, whichever engine read it, so the same box always matches the same
 * part:
 *
 * - UPC-A as its 12 digits. The ZXing engine reads it as an EAN-13 with a
 *   leading 0, which is dropped.
 * - UPC-E as the 8 digits printed under it. The ZXing engine expands it to
 *   the full UPC-A number, which is compressed back.
 *
 * Every other code is left exactly as read.
 */
export function canonicalBarcode(format: string, rawValue: string): string {
    if (
        (format === 'ean_13' || format === 'upc_a') &&
        /^0\d{12}$/.test(rawValue)
    ) {
        return rawValue.slice(1);
    }

    if (format === 'upc_e' && /^0?\d{12}$/.test(rawValue)) {
        return compressUpcA(rawValue.slice(-12)) ?? rawValue;
    }

    return rawValue;
}

/**
 * Turn the 12-digit UPC-A form of a UPC-E code back into its 8 digits, using
 * the standard zero-suppression rules. Returns null for a number no UPC-E
 * code expands to.
 */
function compressUpcA(upcA: string): string | null {
    const system = upcA[0];
    const maker = upcA.slice(1, 6);
    const product = upcA.slice(6, 11);
    const check = upcA[11];

    if (system !== '0' && system !== '1') {
        return null;
    }

    if (
        /^[012]$/.test(maker[2]) &&
        maker.endsWith('00') &&
        product.startsWith('00')
    ) {
        return `${system}${maker.slice(0, 2)}${product.slice(2)}${maker[2]}${check}`;
    }

    if (maker.endsWith('00') && product.startsWith('000')) {
        return `${system}${maker.slice(0, 3)}${product.slice(3)}3${check}`;
    }

    if (maker.endsWith('0') && product.startsWith('0000')) {
        return `${system}${maker.slice(0, 4)}${product[4]}4${check}`;
    }

    if (product.startsWith('0000') && /^[5-9]$/.test(product[4])) {
        return `${system}${maker}${product[4]}${check}`;
    }

    return null;
}
