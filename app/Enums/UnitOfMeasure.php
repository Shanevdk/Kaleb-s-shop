<?php

namespace App\Enums;

enum UnitOfMeasure: string
{
    case Each = 'each';
    case Set = 'set';
    case Pair = 'pair';
    case Litre = 'litre';
    case Millilitre = 'millilitre';
    case Kilogram = 'kilogram';
    case Gram = 'gram';
    case Metre = 'metre';

    /**
     * Get the human readable label for the unit.
     */
    public function label(): string
    {
        return match ($this) {
            self::Each => 'Each',
            self::Set => 'Set',
            self::Pair => 'Pair',
            self::Litre => 'Litres',
            self::Millilitre => 'Millilitres',
            self::Kilogram => 'Kilograms',
            self::Gram => 'Grams',
            self::Metre => 'Metres',
        };
    }

    /**
     * Get the short suffix shown next to a quantity.
     */
    public function abbreviation(): string
    {
        return match ($this) {
            self::Each => '',
            self::Set => 'sets',
            self::Pair => 'pairs',
            self::Litre => 'L',
            self::Millilitre => 'mL',
            self::Kilogram => 'kg',
            self::Gram => 'g',
            self::Metre => 'm',
        };
    }

    /**
     * Determine whether the unit is poured or cut rather than counted, so a
     * part of one can be used and the amount has to be asked for.
     */
    public function isMeasured(): bool
    {
        return match ($this) {
            self::Each, self::Set, self::Pair => false,
            default => true,
        };
    }

    /**
     * Get the smallest sensible increment for the unit.
     */
    public function step(): float
    {
        return match ($this) {
            self::Millilitre, self::Gram => 10,
            self::Litre, self::Kilogram, self::Metre => 0.1,
            default => 1,
        };
    }

    /**
     * Get the one-tap amounts offered when logging usage.
     *
     * @return array<int, float>
     */
    public function quickAmounts(): array
    {
        return match ($this) {
            self::Litre => [0.5, 1, 2, 4, 5],
            self::Millilitre => [50, 100, 250, 500],
            self::Kilogram => [0.1, 0.25, 0.5, 1],
            self::Gram => [10, 25, 50, 100],
            self::Metre => [0.5, 1, 2, 5],
            default => [1, 2, 4],
        };
    }

    /**
     * Get every unit as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $unit): array => ['value' => $unit->value, 'label' => $unit->label()],
            self::cases(),
        );
    }

    /**
     * Get every unit with everything the forms need to know about it.
     *
     * @return array<int, array{value: string, label: string, abbreviation: string, is_measured: bool, step: float, quick_amounts: array<int, float>}>
     */
    public static function catalog(): array
    {
        return array_map(
            fn (self $unit): array => [
                'value' => $unit->value,
                'label' => $unit->label(),
                'abbreviation' => $unit->abbreviation(),
                'is_measured' => $unit->isMeasured(),
                'step' => $unit->step(),
                'quick_amounts' => $unit->quickAmounts(),
            ],
            self::cases(),
        );
    }
}
