<?php

namespace App\Enums;

enum PartCategory: string
{
    case Filters = 'filters';
    case Fluids = 'fluids';
    case Brakes = 'brakes';
    case Tyres = 'tyres';
    case Belts = 'belts';
    case Electrical = 'electrical';
    case Engine = 'engine';
    case Suspension = 'suspension';
    case Consumables = 'consumables';
    case Tools = 'tools';
    case Other = 'other';

    /**
     * Get the human readable label for the category.
     */
    public function label(): string
    {
        return match ($this) {
            self::Filters => 'Filters',
            self::Fluids => 'Fluids and oils',
            self::Brakes => 'Brakes',
            self::Tyres => 'Tyres and wheels',
            self::Belts => 'Belts and hoses',
            self::Electrical => 'Electrical',
            self::Engine => 'Engine parts',
            self::Suspension => 'Suspension and steering',
            self::Consumables => 'Consumables',
            self::Tools => 'Tools and equipment',
            self::Other => 'Other',
        };
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
