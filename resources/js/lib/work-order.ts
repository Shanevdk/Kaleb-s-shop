import { formatCurrency, formatHours } from '@/lib/format';
import type { WorkOrder } from '@/types';

type Figure = { value: string; hint: string | null };

/**
 * What to call the sheet's cost: a price the shop set by hand, or the
 * estimate worked out from the parts.
 */
export function costLabel(sheet: WorkOrder): string {
    return sheet.quoted_price === null ? 'Estimated cost' : 'Price';
}

/**
 * The sheet's cost in words: the price the shop set by hand, otherwise the
 * parts added up, saying how many have no price yet and whether the AI is
 * still working on them.
 */
export function describeCost(sheet: WorkOrder): Figure {
    if (sheet.quoted_price !== null) {
        return {
            value: formatCurrency(sheet.quoted_price),
            hint: 'Set by the shop',
        };
    }

    const { total, unpriced } = sheet.cost;
    const partCount = sheet.parts.length;
    const pending = sheet.estimating ? 'Being worked out' : 'To be confirmed';

    if (partCount === 0) {
        return { value: formatCurrency(0), hint: 'No parts needed' };
    }

    if (unpriced === partCount) {
        return { value: pending, hint: null };
    }

    const estimated = sheet.parts.some((part) => part.priced_by === 'estimate');

    return {
        value: formatCurrency(total),
        hint:
            unpriced > 0
                ? `Plus ${unpriced} part${unpriced === 1 ? '' : 's'} not priced yet`
                : estimated
                  ? 'Includes AI-estimated part prices'
                  : 'At stock prices',
    };
}

/**
 * The sheet's estimated repair time in words: the AI's range when it gave
 * one, otherwise its single figure.
 */
export function describeTime(sheet: WorkOrder): Figure {
    const time = sheet.time;

    if (time === null) {
        return {
            value: sheet.estimating ? 'Being worked out' : 'To be confirmed',
            hint: null,
        };
    }

    if (time.low !== null && time.high !== null && time.low !== time.high) {
        return {
            value: `${formatHours(time.low)}–${formatHours(time.high)}`,
            hint: `About ${formatHours(time.hours)}`,
        };
    }

    return { value: formatHours(time.hours), hint: null };
}
