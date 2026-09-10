import { Head, Link, usePage } from '@inertiajs/react';
import {
    Car,
    ClipboardList,
    Clock,
    Gauge,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { dashboard, login, register } from '@/routes';

const features = [
    {
        icon: Car,
        title: 'Your fleet, on file',
        description:
            'Add every machine once — make, model, year, plate, VIN, odometer — and keep it all in one place.',
    },
    {
        icon: ClipboardList,
        title: 'Every job logged',
        description:
            'Record what you did, the parts you fitted and the notes the next mechanic will need.',
    },
    {
        icon: Clock,
        title: 'Hours and cost',
        description:
            'Track labour hours, parts and labour cost per job, then see the running total per vehicle.',
    },
    {
        icon: Gauge,
        title: 'Full service history',
        description:
            'Filter the log by vehicle or status and pull up a complete history in seconds.',
    },
];

export default function Welcome() {
    const { auth, name } = usePage().props;

    return (
        <>
            <Head title="Workshop records, done properly" />

            <div className="flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
                <header className="border-b border-neutral-200 dark:border-neutral-800">
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="text-sm font-bold tracking-[0.22em] uppercase">
                                {name}
                            </span>
                        </div>

                        <nav className="flex items-center gap-2 text-sm">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="rounded-md px-4 py-2 font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                                    >
                                        Get started
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                <main className="flex-1">
                    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
                        <p className="text-xs font-semibold tracking-[0.3em] text-neutral-500 uppercase">
                            Workshop records
                        </p>
                        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
                            Every job, every vehicle, written down properly.
                        </h1>
                        <p className="mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
                            {name} is a service log built for the person holding
                            the spanner. Add the vehicles you work on, log what
                            you did, and never guess when that belt was last
                            changed.
                        </p>

                        <div className="mt-10 flex flex-wrap items-center gap-3">
                            <Link
                                href={auth.user ? dashboard() : register()}
                                className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                            >
                                <Wrench className="size-4" />
                                {auth.user
                                    ? 'Open the workshop'
                                    : 'Start your log'}
                            </Link>
                            {!auth.user && (
                                <Link
                                    href={login()}
                                    className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                >
                                    I already have an account
                                </Link>
                            )}
                        </div>
                    </section>

                    <section className="border-t border-neutral-200 dark:border-neutral-800">
                        <div className="mx-auto grid w-full max-w-6xl gap-px bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4 dark:bg-neutral-800">
                            {features.map((feature) => (
                                <article
                                    key={feature.title}
                                    className="bg-white p-8 dark:bg-neutral-950"
                                >
                                    <feature.icon className="size-5" />
                                    <h2 className="mt-4 font-semibold">
                                        {feature.title}
                                    </h2>
                                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        {feature.description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="mx-auto w-full max-w-6xl px-6 py-20">
                        <div className="flex flex-col items-start gap-6 rounded-2xl bg-neutral-900 p-10 text-white sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-900">
                            <div className="max-w-xl space-y-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Stop keeping the history in your head.
                                </h2>
                                <p className="flex items-center gap-2 text-sm text-neutral-400">
                                    <ShieldCheck className="size-4" />
                                    Your records, your account, private by
                                    default.
                                </p>
                            </div>
                            <Link
                                href={auth.user ? dashboard() : register()}
                                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
                            >
                                {auth.user
                                    ? 'Go to dashboard'
                                    : 'Create account'}
                            </Link>
                        </div>
                    </section>
                </main>

                <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
                    <div className="mx-auto w-full max-w-6xl px-6 text-xs tracking-widest text-neutral-500 uppercase">
                        {name} — workshop service records
                    </div>
                </footer>
            </div>
        </>
    );
}
