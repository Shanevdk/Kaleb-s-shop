import { Head } from '@inertiajs/react';
import { ImagePlus, MonitorPlay, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    previewScreenSaver,
    screenSaverPanels,
    updateScreenSaver,
    useScreenSaver,
} from '@/hooks/use-screen-saver';
import type { ScreenSaverPanel } from '@/hooks/use-screen-saver';
import {
    useScreenSaverImages,
    useScreenSaverImageUrls,
} from '@/hooks/use-screen-saver-images';
import {
    addScreenSaverImage,
    removeScreenSaverImage,
} from '@/lib/screen-saver-images';
import { cn } from '@/lib/utils';
import { edit as editScreenSaver } from '@/routes/screen-saver';

const delays = [1, 2, 5, 10, 15, 30];
const panelDelays = [5, 10, 15, 20, 30, 60];

function Segmented<T extends string | number>({
    label,
    value,
    options,
    onChange,
    disabled = false,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                'inline-flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800',
                disabled && 'pointer-events-none opacity-50',
            )}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    disabled={disabled}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'rounded-md px-3.5 py-1.5 text-sm transition-colors',
                        value === option.value
                            ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                            : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function PanelToggles({
    panels,
    disabled,
}: {
    panels: ScreenSaverPanel[];
    disabled: boolean;
}) {
    function toggle(value: ScreenSaverPanel, checked: boolean): void {
        if (checked) {
            if (!panels.includes(value)) {
                updateScreenSaver({ panels: [...panels, value] });
            }

            return;
        }

        // Always leave something on the screen saver.
        if (panels.length > 1) {
            updateScreenSaver({
                panels: panels.filter((panel) => panel !== value),
            });
        }
    }

    return (
        <ul className="grid gap-2 sm:grid-cols-2">
            {screenSaverPanels.map((panel) => {
                const checked = panels.includes(panel.value);
                const id = `screen_saver_panel_${panel.value}`;

                return (
                    <li
                        key={panel.value}
                        className="flex items-start gap-3 rounded-lg border p-3"
                    >
                        <Checkbox
                            id={id}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(isChecked) =>
                                toggle(panel.value, isChecked === true)
                            }
                        />
                        <div className="grid gap-1">
                            <Label htmlFor={id}>{panel.label}</Label>
                            <p className="text-muted-foreground text-sm">
                                {panel.description}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function PicturesManager({ disabled }: { disabled: boolean }) {
    const images = useScreenSaverImages();
    const urls = useScreenSaverImageUrls();
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement | null>(null);

    async function addFiles(files: FileList | null): Promise<void> {
        // The file input's accept="image/*" already restricts the picker;
        // don't re-check file.type here, since phones often leave it blank
        // or unrecognised (HEIC photos in particular) and that would silently
        // drop the file with no feedback.
        const picked = Array.from(files ?? []);

        if (picked.length === 0) {
            return;
        }

        setBusy(true);

        try {
            for (const file of picked) {
                await addScreenSaverImage(file);
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                    <Label>Pictures</Label>
                    <p className="text-muted-foreground text-sm">
                        Stored on this device only. Turn on
                        &ldquo;Pictures&rdquo; above to show them.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || busy}
                    onClick={() => input.current?.click()}
                >
                    <ImagePlus />
                    Add pictures
                </Button>
                <input
                    ref={input}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        void addFiles(event.target.files);
                        event.target.value = '';
                    }}
                />
            </div>

            {images.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                    No pictures added yet.
                </p>
            ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((image) => {
                        const url = urls.find(
                            (entry) => entry.id === image.id,
                        )?.url;

                        return (
                            <li
                                key={image.id}
                                className="group bg-muted/40 relative aspect-square overflow-hidden rounded-lg border"
                            >
                                {url && (
                                    <img
                                        src={url}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover"
                                    />
                                )}
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1.5 right-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                    onClick={() =>
                                        removeScreenSaverImage(image.id)
                                    }
                                    aria-label={`Remove ${image.name}`}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function ScreenSaverSettings() {
    const settings = useScreenSaver();
    const showsPictures = settings.panels.includes('pictures');

    return (
        <>
            <Head title="Screen saver settings" />

            <h1 className="sr-only">Screen saver settings</h1>

            <div className="space-y-8">
                <Heading
                    variant="small"
                    title="Screen saver"
                    description="Drops down over the app when nobody has used it for a while, and goes away only when it's deliberately tapped or clicked. These settings are saved on this device only."
                />

                <div className="flex items-start gap-3">
                    <Checkbox
                        id="screen_saver_enabled"
                        checked={settings.enabled}
                        onCheckedChange={(checked) =>
                            updateScreenSaver({ enabled: checked === true })
                        }
                    />
                    <div className="grid gap-1">
                        <Label htmlFor="screen_saver_enabled">
                            Show the screen saver
                        </Label>
                        <p className="text-muted-foreground text-sm">
                            Turn it off on a device you only use now and then.
                        </p>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label>Wait before it comes on</Label>
                    <Segmented
                        label="Wait before it comes on"
                        value={settings.minutes}
                        disabled={!settings.enabled}
                        options={delays.map((minutes) => ({
                            value: minutes,
                            label: `${minutes} min`,
                        }))}
                        onChange={(minutes) => updateScreenSaver({ minutes })}
                    />
                </div>

                <div className="grid gap-2">
                    <Label>What to show</Label>
                    <PanelToggles
                        panels={settings.panels}
                        disabled={!settings.enabled}
                    />
                </div>

                {showsPictures && (
                    <div className="grid gap-2">
                        <Label>Time on each picture</Label>
                        <Segmented
                            label="Time on each picture"
                            value={settings.secondsPerPanel}
                            disabled={!settings.enabled}
                            options={panelDelays.map((seconds) => ({
                                value: seconds,
                                label: `${seconds}s`,
                            }))}
                            onChange={(secondsPerPanel) =>
                                updateScreenSaver({ secondsPerPanel })
                            }
                        />
                    </div>
                )}

                <PicturesManager disabled={!settings.enabled} />

                {settings.panels.includes('clock') && (
                    <>
                        <div className="grid gap-2">
                            <Label>Clock</Label>
                            <Segmented
                                label="Clock"
                                value={settings.clock}
                                disabled={!settings.enabled}
                                options={[
                                    {
                                        value: '12h',
                                        label: '12 hour (3:45 PM)',
                                    },
                                    { value: '24h', label: '24 hour (15:45)' },
                                ]}
                                onChange={(clock) =>
                                    updateScreenSaver({ clock })
                                }
                            />
                        </div>

                        <div className="grid gap-3">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="screen_saver_seconds"
                                    checked={settings.showSeconds}
                                    disabled={!settings.enabled}
                                    onCheckedChange={(checked) =>
                                        updateScreenSaver({
                                            showSeconds: checked === true,
                                        })
                                    }
                                />
                                <Label htmlFor="screen_saver_seconds">
                                    Show seconds
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="screen_saver_date"
                                    checked={settings.showDate}
                                    disabled={!settings.enabled}
                                    onCheckedChange={(checked) =>
                                        updateScreenSaver({
                                            showDate: checked === true,
                                        })
                                    }
                                />
                                <Label htmlFor="screen_saver_date">
                                    Show the date
                                </Label>
                            </div>
                        </div>
                    </>
                )}

                <Button
                    variant="outline"
                    onClick={previewScreenSaver}
                    disabled={!settings.enabled}
                >
                    <MonitorPlay />
                    Try it now
                </Button>
            </div>
        </>
    );
}

ScreenSaverSettings.layout = {
    breadcrumbs: [
        {
            title: 'Screen saver settings',
            href: editScreenSaver(),
        },
    ],
};
