const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-US');

export function formatCurrency(value: number | null | undefined): string {
    return currencyFormatter.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined): string {
    return numberFormatter.format(value ?? 0);
}

export function formatOdometer(value: number | null | undefined): string {
    return value === null || value === undefined
        ? '—'
        : `${numberFormatter.format(value)} km`;
}

export function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Write an amount the way a person would say it, with its unit tacked on.
 * Whole numbers stay whole; 1.50 L reads as 1.5 L.
 */
export function formatQuantity(
    value: number | null | undefined,
    unit?: string | null,
): string {
    const amount = Number(value ?? 0)
        .toFixed(2)
        .replace(/\.?0+$/, '');

    return unit ? `${amount} ${unit}` : amount;
}

export function formatHours(value: number | null | undefined): string {
    return `${(value ?? 0).toFixed(2).replace(/\.00$/, '')} h`;
}
