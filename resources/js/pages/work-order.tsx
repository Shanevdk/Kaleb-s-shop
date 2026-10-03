import { Head } from '@inertiajs/react';
import { Banknote, Clock, Printer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppWordmark from '@/components/app-wordmark';
import {
    formatCurrency,
    formatDate,
    formatOdometer,
    formatQuantity,
} from '@/lib/format';
import { costLabel, describeCost, describeTime } from '@/lib/work-order';
import type { WorkOrder as Sheet } from '@/types';

/**
 * A job written up to share: what is wrong, the parts it takes, and what it
 * should cost and how long the repair should take, both worked out
 * automatically. Opened from a shared link with no login, and laid out to
 * print or save as a PDF. It stays light whatever the viewer's theme, so it
 * reads the same on paper.
 */
export default function WorkOrder({
    companyName,
    sheet,
}: {
    companyName: string;
    sheet: Sheet;
}) {
    const cost = describeCost(sheet);
    const time = describeTime(sheet);

    return (
        <>
            <Head title={`Work order: ${sheet.title}`} />

            <div className="min-h-svh bg-zinc-100 text-zinc-900 print:bg-white">
                <header className="bg-brand-navy text-white [print-color-adjust:exact]">
                    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
                        <span className="ring-brand-orange flex size-10 shrink-0 items-center justify-center rounded-lg ring-1">
                            <AppLogoIcon className="size-8 fill-current" />
                        </span>
                        <div className="grid min-w-0 flex-1 gap-1">
                            <AppWordmark className="h-4" onDark />
                            <p className="text-xs text-white/70">
                                Work order
                                {sheet.updated_on &&
                                    ` · ${formatDate(sheet.updated_on)}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10 print:hidden"
                        >
                            <Printer className="size-4" />
                            Print / PDF
                        </button>
                    </div>
                </header>

                <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 print:py-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {sheet.title}
                        </h1>
                        <p className="text-sm text-zinc-500">
                            {sheet.type_label} · {sheet.status_label}
                        </p>
                    </div>

                    {sheet.vehicle && (
                        <Section title="Vehicle">
                            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                                <Detail label="Vehicle">
                                    {sheet.vehicle.name}
                                </Detail>
                                {sheet.vehicle.registration && (
                                    <Detail label="Plate">
                                        {sheet.vehicle.registration}
                                    </Detail>
                                )}
                                {sheet.vehicle.vin && (
                                    <Detail label="VIN">
                                        <span className="font-mono break-all">
                                            {sheet.vehicle.vin}
                                        </span>
                                    </Detail>
                                )}
                                {sheet.vehicle.odometer !== null && (
                                    <Detail label="Odometer">
                                        {formatOdometer(sheet.vehicle.odometer)}
                                    </Detail>
                                )}
                            </dl>
                        </Section>
                    )}

                    <Section title="What's wrong">
                        <p className="text-sm leading-relaxed whitespace-pre-line">
                            {sheet.reason || 'To be confirmed.'}
                        </p>
                    </Section>

                    <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
                        <Figure
                            icon={Banknote}
                            label={costLabel(sheet)}
                            value={cost.value}
                            hint={cost.hint}
                        />
                        <Figure
                            icon={Clock}
                            label="Estimated repair time"
                            value={time.value}
                            hint={time.hint}
                        />
                    </div>

                    {sheet.parts.length > 0 && (
                        <Section title="Parts needed">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-zinc-500">
                                        <th className="pb-2 font-medium">
                                            Part
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Qty
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Cost
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {sheet.parts.map((part, index) => (
                                        <tr key={index}>
                                            <td className="py-2 pr-4">
                                                {part.name}
                                            </td>
                                            <td className="py-2 text-right whitespace-nowrap text-zinc-500 tabular-nums">
                                                {formatQuantity(
                                                    part.quantity,
                                                    part.unit_abbreviation,
                                                )}
                                            </td>
                                            <td className="py-2 pl-4 text-right whitespace-nowrap tabular-nums">
                                                {part.line_total === null ? (
                                                    <span className="text-zinc-400">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        {part.priced_by ===
                                                            'estimate' && (
                                                            <span
                                                                className="text-zinc-400"
                                                                title="Priced by AI estimate"
                                                            >
                                                                ≈{' '}
                                                            </span>
                                                        )}
                                                        {formatCurrency(
                                                            part.line_total,
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    <p className="px-1 text-xs leading-relaxed text-zinc-500">
                        {sheet.quoted_price === null
                            ? 'Costs come from stock prices, with ≈ marking a part priced by an AI estimate. The repair time is an AI estimate of how long the work takes. Both may change once the work starts.'
                            : 'The price is set by the shop. Part costs come from stock prices, with ≈ marking a part priced by an AI estimate. The repair time is an AI estimate of how long the work takes and may change once the work starts.'}{' '}
                        Prepared by {companyName}.
                    </p>
                </main>
            </div>
        </>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="break-inside-avoid rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                {title}
            </h2>
            {children}
        </section>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="font-medium">{children}</dd>
        </div>
    );
}

function Figure({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint: string | null;
}) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                <Icon className="size-4" />
                {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {value}
            </p>
            {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}
