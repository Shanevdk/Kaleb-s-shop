<?php

namespace App\Enums;

enum CheckStatus: string
{
    case Pending = 'pending';
    case Good = 'good';
    case Attention = 'attention';
    case Fixed = 'fixed';

    /**
     * Get the human readable label for the check status.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Not checked',
            self::Good => 'Good',
            self::Attention => 'Needs attention',
            self::Fixed => 'Fixed',
        };
    }

    /**
     * Determine whether the item has actually been checked.
     */
    public function isChecked(): bool
    {
        return $this !== self::Pending;
    }

    /**
     * Determine whether the item still needs work.
     *
     * Something put right on the day is not outstanding, so only the items
     * left flagged for attention count.
     */
    public function needsWork(): bool
    {
        return $this === self::Attention;
    }

    /**
     * Get the three statuses a mechanic can actually press.
     *
     * @return array<int, self>
     */
    public static function choices(): array
    {
        return [self::Good, self::Attention, self::Fixed];
    }

    /**
     * Get every check status as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $status): array => ['value' => $status->value, 'label' => $status->label()],
            self::cases(),
        );
    }
}
