<?php

namespace App\Enums;

enum PhotoAngle: string
{
    case Front = 'front';
    case FrontRight = 'front_right';
    case Right = 'right';
    case RearRight = 'rear_right';
    case Rear = 'rear';
    case RearLeft = 'rear_left';
    case Left = 'left';
    case FrontLeft = 'front_left';
    case Top = 'top';
    case Engine = 'engine';

    /**
     * Get the human readable label for the shot.
     */
    public function label(): string
    {
        return match ($this) {
            self::Front => 'Front',
            self::FrontRight => 'Front right',
            self::Right => 'Right side',
            self::RearRight => 'Rear right',
            self::Rear => 'Rear',
            self::RearLeft => 'Rear left',
            self::Left => 'Left side',
            self::FrontLeft => 'Front left',
            self::Top => 'From above',
            self::Engine => 'Engine bay',
        };
    }

    /**
     * Where to stand for the shot.
     */
    public function hint(): string
    {
        return match ($this) {
            self::Front => 'Square on to the front, whole machine in frame.',
            self::FrontRight => 'Halfway round the front-right corner.',
            self::Right => 'Square on to the right-hand side.',
            self::RearRight => 'Halfway round the rear-right corner.',
            self::Rear => 'Square on to the back.',
            self::RearLeft => 'Halfway round the rear-left corner.',
            self::Left => 'Square on to the left-hand side.',
            self::FrontLeft => 'Halfway round the front-left corner.',
            self::Top => 'Looking straight down, front of the machine at the top of the frame.',
            self::Engine => 'Bonnet or cover open, straight down into the engine.',
        };
    }

    /**
     * The bearing around the machine the shot is taken from, clockwise from
     * the front, or null for the shots that are not part of the walk-around.
     */
    public function degrees(): ?int
    {
        return match ($this) {
            self::Front => 0,
            self::FrontRight => 45,
            self::Right => 90,
            self::RearRight => 135,
            self::Rear => 180,
            self::RearLeft => 225,
            self::Left => 270,
            self::FrontLeft => 315,
            self::Top, self::Engine => null,
        };
    }

    /**
     * Get every shot as the front end wants it.
     *
     * @return array<int, array{value: string, label: string, hint: string, degrees: int|null}>
     */
    public static function catalog(): array
    {
        return array_map(
            fn (self $angle): array => [
                'value' => $angle->value,
                'label' => $angle->label(),
                'hint' => $angle->hint(),
                'degrees' => $angle->degrees(),
            ],
            self::cases(),
        );
    }
}
