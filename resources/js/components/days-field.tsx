import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The day after the given one, as YYYY-MM-DD.
 */
const dayAfter = (date: string) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

/**
 * The day to add next: the one after the latest day picked so far, or the
 * fallback when none has been picked yet.
 */
const nextDay = (days: string[], fallback: string) => {
    const picked = days.filter((day) => day !== '').sort();

    return picked.length > 0 ? dayAfter(picked[picked.length - 1]) : fallback;
};

/**
 * Pick the day, or days, a job is booked on. Each one is sent as days[];
 * give it a new key to start it over from its defaults.
 */
export default function DaysField({
    id,
    defaultDays,
    errors,
}: {
    /** Prefix for the inputs' ids, unique on the page. */
    id: string;
    defaultDays: string[];
    errors: Partial<Record<string, string>>;
}) {
    const [days, setDays] = useState(defaultDays);

    const error =
        errors.days ??
        errors.performed_on ??
        Object.entries(errors).find(([key]) => key.startsWith('days.'))?.[1];

    return (
        <div className="grid gap-2">
            <Label htmlFor={`${id}_0`}>
                {days.length > 1 ? 'Days' : 'Day'}
            </Label>
            {days.map((day, position) => (
                <div key={position} className="flex items-center gap-2">
                    <Input
                        id={`${id}_${position}`}
                        name="days[]"
                        type="date"
                        value={day}
                        onChange={(event) =>
                            setDays((current) =>
                                current.map((existing, index) =>
                                    index === position
                                        ? event.target.value
                                        : existing,
                                ),
                            )
                        }
                        aria-label={`Day ${position + 1}`}
                        required
                    />
                    {days.length > 1 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setDays((current) =>
                                    current.filter(
                                        (_, index) => index !== position,
                                    ),
                                )
                            }
                            aria-label={`Remove day ${position + 1}`}
                        >
                            <X />
                        </Button>
                    )}
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() =>
                    setDays((current) => [
                        ...current,
                        nextDay(current, defaultDays[0]),
                    ])
                }
            >
                <Plus />
                Add another day
            </Button>
            <InputError message={error} />
        </div>
    );
}
