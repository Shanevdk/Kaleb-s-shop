import { Form, Head, usePage } from '@inertiajs/react';
import { Check, Copy, Download, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import DeleteConfirm from '@/components/delete-confirm';
import EmptyState from '@/components/empty-state';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useClipboard } from '@/hooks/use-clipboard';
import { dataExport } from '@/routes/admin';
import { destroy, index, store } from '@/routes/admin/api-keys';
import type { ApiKeyItem, NewApiKey } from '@/types';

type Props = {
    apiKeys: ApiKeyItem[];
    /** Where the API starts, e.g. https://example.com/api/v1. */
    apiUrl: string;
    /** The name of each kind of record the API shares. */
    collections: string[];
};

/**
 * A line of code with a button that copies it. One click on the code itself
 * selects all of it, and when the browser will not let the button copy (it
 * only can over HTTPS), the code is selected so it can be copied by hand.
 */
function CopyableCode({ text, label }: { text: string; label: string }) {
    const [copiedText, copy] = useClipboard();
    const codeRef = useRef<HTMLElement>(null);

    const copyText = async () => {
        if (await copy(text)) {
            return;
        }

        const selection = window.getSelection();

        if (codeRef.current && selection) {
            const range = document.createRange();
            range.selectNodeContents(codeRef.current);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        toast.error(
            'This browser would not copy it. It is selected now: copy it with Ctrl+C (⌘C on a Mac) or the Copy menu.',
        );
    };

    return (
        <div className="bg-muted flex items-start gap-2 rounded-lg p-3">
            <code
                ref={codeRef}
                className="flex-1 font-mono text-sm break-all select-all"
            >
                {text}
            </code>
            <Button
                size="sm"
                variant="outline"
                onClick={copyText}
                aria-label={label}
            >
                {copiedText === text ? <Check /> : <Copy />}
                {copiedText === text ? 'Copied' : 'Copy'}
            </Button>
        </div>
    );
}

/**
 * The key just made. It is only ever shown here, once: the server keeps
 * nothing it could be read back from.
 */
function NewKeyCard({
    newKey,
    apiUrl,
    onDone,
}: {
    newKey: NewApiKey;
    apiUrl: string;
    onDone: () => void;
}) {
    return (
        <section className="border-primary/40 bg-card max-w-3xl space-y-4 rounded-xl border-2 p-4 sm:p-6">
            <div className="space-y-1">
                <h2 className="font-semibold">Key for {newKey.name}</h2>
                <p className="text-muted-foreground text-sm">
                    Copy it now and paste it into the other app. It is only
                    shown this once; if it gets lost, delete it and make
                    another.
                </p>
            </div>

            <CopyableCode text={newKey.token} label="Copy the key" />

            <div className="space-y-2">
                <p className="text-sm font-medium">
                    Try it: this downloads everything
                </p>
                <CopyableCode
                    text={`curl -H "Authorization: Bearer ${newKey.token}" ${apiUrl}/export`}
                    label="Copy the example command"
                />
            </div>

            <Button onClick={onDone}>
                <Check />
                Done, I have copied it
            </Button>
        </section>
    );
}

/** What another app needs to know to read the data. */
function HowToConnect({
    apiUrl,
    collections,
}: {
    apiUrl: string;
    collections: string[];
}) {
    const endpoints: { path: string; description: string }[] = [
        {
            path: apiUrl,
            description:
                'Every collection, with how many records each one holds.',
        },
        {
            path: `${apiUrl}/export`,
            description: 'Everything, in one response.',
        },
        {
            path: `${apiUrl}/{collection}`,
            description:
                'One collection, 100 records a page (up to 1000 with ?per_page=). Follow links.next for the next page.',
        },
        {
            path: `${apiUrl}/{collection}/{id}`,
            description: 'A single record.',
        },
    ];

    return (
        <section className="bg-card max-w-3xl space-y-4 rounded-xl border p-4 sm:p-6">
            <div className="space-y-1">
                <h2 className="font-semibold">Connecting an app</h2>
                <p className="text-muted-foreground text-sm">
                    Send the key with every request as an{' '}
                    <code className="font-mono">
                        Authorization: Bearer &lt;key&gt;
                    </code>{' '}
                    header. Everything comes back as JSON.
                </p>
            </div>

            <dl className="space-y-3">
                {endpoints.map((endpoint) => (
                    <div key={endpoint.path} className="space-y-0.5">
                        <dt className="font-mono text-sm break-all">
                            GET {endpoint.path}
                        </dt>
                        <dd className="text-muted-foreground text-sm">
                            {endpoint.description}
                        </dd>
                    </div>
                ))}
            </dl>

            <p className="text-muted-foreground text-sm">
                To keep another app up to date, add{' '}
                <code className="font-mono">
                    ?updated_since=2026-11-01T00:00:00Z
                </code>{' '}
                to the export or a collection to get only what was added or
                changed since then. Deleted records are not listed, so run a
                full export now and then.
            </p>

            <div className="space-y-2">
                <p className="text-sm font-medium">Collections</p>
                <ul className="flex flex-wrap gap-1.5">
                    {collections.map((collection) => (
                        <li
                            key={collection}
                            className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs"
                        >
                            {collection}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default function AdminApiKeysIndex({
    apiKeys,
    apiUrl,
    collections,
}: Props) {
    const { flash } = usePage();

    // Set from the flash once the key is made, and kept until Done is
    // clicked, even if the page reloads its props meanwhile. Read in the
    // form's onSuccess: <Form> accepts an onFlash prop but never calls it.
    // Seeded from the flash too, in case the page mounts afresh with it.
    const [newKey, setNewKey] = useState<NewApiKey | null>(
        (flash.newApiKey as NewApiKey | undefined) ?? null,
    );

    return (
        <>
            <Head title="API keys" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <PageHeader
                    title="API keys"
                    description="Give another app a key and it can read everything here: vehicles, jobs, checklists, parts, equipment and the team. Keys can only read; they never change anything."
                    actions={
                        // A plain link, not an Inertia visit: the server
                        // answers with a file to save, not a page.
                        <Button asChild variant="outline">
                            <a href={dataExport.url()} download>
                                <Download />
                                Export all data
                            </a>
                        </Button>
                    }
                />

                <div className="bg-card max-w-3xl rounded-xl border p-4 sm:p-6">
                    <Form
                        {...store.form()}
                        resetOnSuccess
                        onSuccess={(page) =>
                            setNewKey(
                                (page.flash.newApiKey as
                                    | NewApiKey
                                    | undefined) ?? null,
                            )
                        }
                        className="grid gap-2"
                    >
                        {({ processing, errors }) => (
                            <>
                                <Label htmlFor="name">
                                    What will use the key?
                                </Label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="Accounting, Power BI, the website…"
                                        required
                                        maxLength={80}
                                        autoComplete="off"
                                    />
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        className="shrink-0"
                                    >
                                        <Plus />
                                        Make a key
                                    </Button>
                                </div>
                                <InputError message={errors.name} />
                            </>
                        )}
                    </Form>
                </div>

                {newKey && (
                    <NewKeyCard
                        newKey={newKey}
                        apiUrl={apiUrl}
                        onDone={() => setNewKey(null)}
                    />
                )}

                {apiKeys.length === 0 ? (
                    <EmptyState
                        icon={KeyRound}
                        title="No keys yet"
                        description="Make one above for each app that should read the shop's data."
                    />
                ) : (
                    <div className="bg-card max-w-3xl rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Used by</TableHead>
                                    <TableHead>Key</TableHead>
                                    <TableHead>Made</TableHead>
                                    <TableHead>Last used</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {apiKeys.map((apiKey) => (
                                    <TableRow key={apiKey.id}>
                                        <TableCell className="font-medium">
                                            {apiKey.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs">
                                            {apiKey.hint}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {apiKey.made_at}
                                            {apiKey.made_by &&
                                                ` by ${apiKey.made_by}`}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {apiKey.last_used_ago ?? 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DeleteConfirm
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete the key for ${apiKey.name}`}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                }
                                                title={`Delete the key for ${apiKey.name}?`}
                                                description="It stops working straight away, and anything still using it will no longer be able to read the shop's data."
                                                confirmLabel="Delete key"
                                                form={destroy.form(apiKey.id)}
                                                optimistic={(props) => ({
                                                    apiKeys: (
                                                        props.apiKeys as ApiKeyItem[]
                                                    ).filter(
                                                        (existing) =>
                                                            existing.id !==
                                                            apiKey.id,
                                                    ),
                                                })}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <HowToConnect apiUrl={apiUrl} collections={collections} />
            </div>
        </>
    );
}

AdminApiKeysIndex.layout = {
    breadcrumbs: [{ title: 'API keys', href: index() }],
};
