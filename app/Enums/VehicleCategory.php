<?php

namespace App\Enums;

enum VehicleCategory: string
{
    case Trailer = 'trailer';
    case NonHighway = 'non_highway';
    case Normal = 'normal';

    /**
     * Get the human readable label for the category.
     */
    public function label(): string
    {
        return match ($this) {
            self::Trailer => 'Trailer',
            self::NonHighway => 'Non-highway',
            self::Normal => 'Normal',
        };
    }

    /**
     * Whether the category is exempt from the annual (roadworthy /
     * registration-style) inspection, since it never goes on a public road.
     */
    public function isExemptFromAnnualInspection(): bool
    {
        return $this === self::NonHighway;
    }

    /**
     * Get every category as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $category): array => ['value' => $category->value, 'label' => $category->label()],
            self::cases(),
        );
    }
}
