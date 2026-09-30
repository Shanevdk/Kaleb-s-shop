import { Head } from '@inertiajs/react';
import { MonitorPlay } from 'lucide-react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    previewScreenSaver,
    updateScreenSaver,
    useScreenSaver,
} from '@/hooks/use-screen-saver';
import { cn } from '@/lib/utils';
import { edit as editScreenSaver } from '@/routes/screen-saver';

const delays = [1, 2, 5, 10, 15, 30];

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

export default function ScreenSaverSettings() {
    const settings = useScreenSaver();

    return (
        <>
            <Head title="Screen saver settings" />

            <h1 className="sr-only">Screen saver settings</h1>

            <div className="space-y-8">
                <Heading
                    variant="small"
                    title="Screen saver"
                    description="A clock drops down over the app when nobody has used it for a while, and goes away at the first tap. These settings are saved on this device only."
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
                    <Label>Clock</Label>
                    <Segmented
                        label="Clock"
                        value={settings.clock}
                        disabled={!settings.enabled}
                        options={[
                            { value: '12h', label: '12 hour (3:45 PM)' },
                            { value: '24h', label: '24 hour (15:45)' },
                        ]}
                        onChange={(clock) => updateScreenSaver({ clock })}
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
                        <Label htmlFor="screen_saver_date">Show the date</Label>
                    </div>
                </div>

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
