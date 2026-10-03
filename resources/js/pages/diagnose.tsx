import { Head, Link, useHttp } from '@inertiajs/react';
import {
    AlertTriangle,
    CircleHelp,
    KeyRound,
    ListOrdered,
    Package,
    ShieldAlert,
    Sparkles,
    Stethoscope,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import EmptyState from '@/components/empty-state';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import { CommonRepairs, RecallList } from '@/components/repair-guide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { diagnose } from '@/routes';
import { run } from '@/routes/diagnose';
import { edit as editPart } from '@/routes/inventory';
import type { CommonRepair, Recall, SelectOption } from '@/types';

type ShopVehicle = {
    id: string;
    display_name: string;
    registration: string | null;
    kind: string;
    make: string;
    model: string;
    year: number;
    engine: string | null;
    odometer: number | null;
};

type Problem = {
    vehicle_id: string;
    kind: string;
    make: string;
    model: string;
    year: string;
    engine: string;
    odometer: string;
    codes: string;
    symptoms: string;
    conditions: string;
};

type Likelihood = 'high' | 'medium' | 'low';

type Cause = {
    cause: string;
    likelihood: Likelihood;
    why: string;
    checks: string[];
    fix: string;
    parts: {
        name: string;
        in_stock: { id: string; name: string; quantity: string } | null;
    }[];
};

type Result = {
    machine: { title: string; kind: string; kind_label: string };
    diagnosis: {
        summary: string;
        causes: Cause[];
        first_steps: string[];
        safety: string[];
        questions: string[];
    } | null;
    reply: string | null;
    model: string | null;
    error: string | null;
    common_repairs: CommonRepair[];
    recalls: Recall[];
};

const EMPTY_PROBLEM: Problem = {
    vehicle_id: '',
    kind: '',
    make: '',
    model: '',
    year: '',
    engine: '',
    odometer: '',
    codes: '',
    symptoms: '',
    conditions: '',
};

export default function Diagnose({
    isConfigured,
    kinds,
    vehicles,
}: {
    isConfigured: boolean;
    kinds: SelectOption[];
    vehicles: ShopVehicle[];
}) {
    const http = useHttp<Problem, Result>(EMPTY_PROBLEM);
    const [result, setResult] = useState<Result | null>(null);
    const [failure, setFailure] = useState<string | null>(null);

    const { data, setData, errors, processing } = http;

    /**
     * Fill the machine in from a shop vehicle; the mechanic can still change
     * any of it.
     */
    const pickVehicle = (id: string) => {
        const vehicle = vehicles.find((candidate) => candidate.id === id);

        if (!vehicle) {
            return;
        }

        setData({
            ...data,
            vehicle_id: vehicle.id,
            kind: vehicle.kind,
            make: vehicle.make,
            model: vehicle.model,
            year: String(vehicle.year),
            engine: vehicle.engine ?? '',
            odometer: vehicle.odometer === null ? '' : String(vehicle.odometer),
        });
    };

    const clearVehicle = () =>
        setData({
            ...data,
            vehicle_id: '',
            kind: '',
            make: '',
            model: '',
            year: '',
            engine: '',
            odometer: '',
        });

    const submit = () => {
        setFailure(null);

        http.post(run.url(), {
            onHttpException: (response) => {
                setFailure(
                    response.status === 429
                        ? 'That is a lot of diagnosing in a minute. Wait a moment and try again.'
                        : 'The diagnosis could not be run just now. Try again in a moment.',
                );

                return false;
            },
            onNetworkError: () => {
                setFailure('Could not reach the server. Check the connection.');

                return false;
            },
        })
            .then((response) => {
                if (response) {
                    setResult(response);
                }
            })
            .catch(() => {
                // Already shown through the handlers above.
            });
    };

    return (
        <>
            <Head title="Diagnose a problem" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="Diagnose a problem"
                    description="Say what the machine is and what it is doing. You get the likely causes in order, how to test for each, and what it usually comes in for."
                />

                <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit();
                        }}
                        className="bg-card grid gap-5 rounded-xl border p-5 lg:sticky lg:top-4"
                    >
                        {!isConfigured && (
                            <div className="text-muted-foreground flex gap-3 rounded-lg border border-dashed p-3 text-sm">
                                <KeyRound className="size-4 shrink-0" />
                                <p>
                                    The AI diagnosis is not set up yet (it needs
                                    an OPENROUTER_API_KEY). You still get the
                                    common problems and recalls.
                                </p>
                            </div>
                        )}

                        {vehicles.length > 0 && (
                            <div className="grid gap-2">
                                <Label htmlFor="vehicle_id">
                                    A vehicle in the shop
                                </Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={data.vehicle_id || undefined}
                                        onValueChange={pickVehicle}
                                    >
                                        <SelectTrigger
                                            id="vehicle_id"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Pick one, or fill it in below" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vehicles.map((vehicle) => (
                                                <SelectItem
                                                    key={vehicle.id}
                                                    value={vehicle.id}
                                                >
                                                    {vehicle.display_name}
                                                    {vehicle.registration
                                                        ? ` · ${vehicle.registration}`
                                                        : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {data.vehicle_id && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Clear the vehicle"
                                            onClick={clearVehicle}
                                        >
                                            <X />
                                        </Button>
                                    )}
                                </div>
                                {data.vehicle_id && (
                                    <p className="text-muted-foreground text-xs">
                                        Its service history is used too.
                                    </p>
                                )}
                                <InputError message={errors.vehicle_id} />
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="kind">Type</Label>
                                <Select
                                    value={data.kind || undefined}
                                    onValueChange={(value) =>
                                        setData('kind', value)
                                    }
                                >
                                    <SelectTrigger id="kind" className="w-full">
                                        <SelectValue placeholder="Car, ute, tractor…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {kinds.map((kind) => (
                                            <SelectItem
                                                key={kind.value}
                                                value={kind.value}
                                            >
                                                {kind.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.kind} />
                            </div>

                            <Field
                                id="make"
                                label="Make"
                                placeholder="Toyota"
                                value={data.make}
                                onChange={(value) => setData('make', value)}
                                error={errors.make}
                            />
                            <Field
                                id="model"
                                label="Model"
                                placeholder="Hilux"
                                value={data.model}
                                onChange={(value) => setData('model', value)}
                                error={errors.model}
                            />
                            <Field
                                id="year"
                                label="Year"
                                placeholder="2016"
                                inputMode="numeric"
                                value={data.year}
                                onChange={(value) => setData('year', value)}
                                error={errors.year}
                            />
                            <Field
                                id="odometer"
                                label="Km or hours"
                                placeholder="184000"
                                inputMode="numeric"
                                value={data.odometer}
                                onChange={(value) => setData('odometer', value)}
                                error={errors.odometer}
                            />
                            <div className="sm:col-span-2">
                                <Field
                                    id="engine"
                                    label="Engine"
                                    placeholder="2.8 L 4-cyl diesel (1GD)"
                                    value={data.engine}
                                    onChange={(value) =>
                                        setData('engine', value)
                                    }
                                    error={errors.engine}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Field
                                    id="codes"
                                    label="Fault codes"
                                    placeholder="P0300, P0171"
                                    value={data.codes}
                                    onChange={(value) =>
                                        setData('codes', value)
                                    }
                                    error={errors.codes}
                                    mono
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="symptoms">What is it doing?</Label>
                            <Textarea
                                id="symptoms"
                                value={data.symptoms}
                                onChange={(event) =>
                                    setData('symptoms', event.target.value)
                                }
                                placeholder="Rough idle and a shudder under load, check engine light flashing, down on power up hills."
                                rows={4}
                                required
                            />
                            <InputError message={errors.symptoms} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="conditions">
                                When does it happen?{' '}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Textarea
                                id="conditions"
                                value={data.conditions}
                                onChange={(event) =>
                                    setData('conditions', event.target.value)
                                }
                                placeholder="Cold start only, after 20 minutes of driving, in the wet, over bumps…"
                                rows={2}
                            />
                            <InputError message={errors.conditions} />
                        </div>

                        <Button type="submit" disabled={processing}>
                            <Stethoscope />
                            {processing ? 'Diagnosing…' : 'Diagnose'}
                        </Button>
                    </form>

                    <div className="grid min-w-0 gap-6">
                        {failure && (
                            <Notice icon={AlertTriangle}>{failure}</Notice>
                        )}

                        {processing ? (
                            <ResultSkeleton />
                        ) : result ? (
                            <DiagnosisResult result={result} />
                        ) : (
                            <EmptyState
                                icon={Stethoscope}
                                title="Describe the problem"
                                description="Fill in the machine and what it is doing, then hit Diagnose. Fault codes and when it happens help narrow it down."
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

Diagnose.layout = {
    breadcrumbs: [{ title: 'Diagnose', href: diagnose() }],
};

function Field({
    id,
    label,
    value,
    onChange,
    error,
    placeholder,
    inputMode,
    mono = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    inputMode?: 'numeric';
    mono?: boolean;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                autoComplete="off"
                className={cn(mono && 'font-mono')}
            />
            <InputError message={error} />
        </div>
    );
}

function Notice({
    icon: Icon,
    children,
}: {
    icon: typeof AlertTriangle;
    children: ReactNode;
}) {
    return (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <Icon className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>{children}</div>
        </div>
    );
}

function DiagnosisResult({ result }: { result: Result }) {
    const { diagnosis } = result;

    return (
        <>
            <section className="bg-card space-y-3 rounded-xl border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                        {result.machine.title}
                    </h2>
                    <span className="text-muted-foreground text-sm">
                        {result.machine.kind_label}
                    </span>
                </div>

                {diagnosis?.summary && <p>{diagnosis.summary}</p>}

                {result.reply && (
                    <p className="text-sm whitespace-pre-wrap">
                        {result.reply}
                    </p>
                )}

                {result.model && (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Sparkles className="size-3" />
                        General guidance from {result.model}. Confirm with a
                        test before buying parts, and check the workshop manual
                        for specs.
                    </p>
                )}
            </section>

            {result.error && (
                <Notice icon={AlertTriangle}>{result.error}</Notice>
            )}

            {diagnosis && diagnosis.safety.length > 0 && (
                <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                        <ShieldAlert className="size-4" />
                        Safety first
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {diagnosis.safety.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </section>
            )}

            {diagnosis && diagnosis.first_steps.length > 0 && (
                <section className="bg-card rounded-xl border p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                        <ListOrdered className="text-muted-foreground size-4" />
                        Start here
                    </h3>
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                        {diagnosis.first_steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                </section>
            )}

            {diagnosis && diagnosis.causes.length > 0 && (
                <section className="space-y-3">
                    <h3 className="font-semibold">Likely causes</h3>
                    {diagnosis.causes.map((cause, index) => (
                        <CauseCard
                            key={`${index}-${cause.cause}`}
                            cause={cause}
                            rank={index + 1}
                        />
                    ))}
                </section>
            )}

            {diagnosis && diagnosis.questions.length > 0 && (
                <section className="bg-card rounded-xl border p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                        <CircleHelp className="text-muted-foreground size-4" />
                        To narrow it down
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {diagnosis.questions.map((question) => (
                            <li key={question}>{question}</li>
                        ))}
                    </ul>
                </section>
            )}

            {result.common_repairs.length > 0 && (
                <CommonRepairs repairs={result.common_repairs} />
            )}

            {result.recalls.length > 0 && (
                <RecallList recalls={result.recalls} />
            )}
        </>
    );
}

const LIKELIHOOD_STYLES: Record<Likelihood, string> = {
    high: 'bg-red-500/15 text-red-700 dark:text-red-400',
    medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    low: 'bg-muted text-muted-foreground',
};

function CauseCard({ cause, rank }: { cause: Cause; rank: number }) {
    return (
        <article className="bg-card space-y-3 rounded-xl border p-5">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-medium">
                    <span className="text-muted-foreground mr-2 tabular-nums">
                        {rank}.
                    </span>
                    {cause.cause}
                </h4>
                <span
                    className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        LIKELIHOOD_STYLES[cause.likelihood],
                    )}
                >
                    {cause.likelihood} chance
                </span>
            </header>

            {cause.why && (
                <p className="text-muted-foreground text-sm">{cause.why}</p>
            )}

            {cause.checks.length > 0 && (
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest uppercase">
                        How to check
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                        {cause.checks.map((check) => (
                            <li key={check}>{check}</li>
                        ))}
                    </ol>
                </div>
            )}

            {cause.fix && (
                <p className="text-sm">
                    <span className="font-medium">Fix:</span> {cause.fix}
                </p>
            )}

            {cause.parts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {cause.parts.map((part) =>
                        part.in_stock ? (
                            <Link
                                key={part.name}
                                href={editPart(part.in_stock.id)}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                                title={`On the shelf as ${part.in_stock.name}`}
                            >
                                <Package className="size-3" />
                                {part.name} · {part.in_stock.quantity} in stock
                            </Link>
                        ) : (
                            <span
                                key={part.name}
                                className="bg-muted rounded-full px-2.5 py-0.5 text-xs"
                            >
                                {part.name}
                            </span>
                        ),
                    )}
                </div>
            )}
        </article>
    );
}

function ResultSkeleton() {
    return (
        <div className="grid gap-4">
            <div className="bg-card space-y-3 rounded-xl border p-5">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
            {[0, 1, 2].map((key) => (
                <div
                    key={key}
                    className="bg-card space-y-3 rounded-xl border p-5"
                >
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                </div>
            ))}
            <p className="text-muted-foreground text-center text-sm">
                Working through the likely causes. Free models can take up to a
                minute.
            </p>
        </div>
    );
}
