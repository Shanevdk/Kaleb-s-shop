<?php

namespace App\Enums;

enum ChecklistTemplate: string
{
    case MonthlyCheck = 'monthly_check';
    case AnnualInspection = 'annual_inspection';
    case BasicService = 'basic_service';
    case FullService = 'full_service';
    case SafetyCheck = 'safety_check';
    case PrePurchase = 'pre_purchase';
    case TyresAndBrakes = 'tyres_and_brakes';

    /**
     * Get the human readable label for the checklist.
     */
    public function label(): string
    {
        return match ($this) {
            self::MonthlyCheck => 'Monthly check',
            self::AnnualInspection => 'Annual inspection',
            self::BasicService => 'Basic service',
            self::FullService => 'Full service',
            self::SafetyCheck => 'Safety / roadworthy check',
            self::PrePurchase => 'Pre-purchase inspection',
            self::TyresAndBrakes => 'Tyres and brakes',
        };
    }

    /**
     * Get a short description of what the checklist covers.
     */
    public function description(): string
    {
        return match ($this) {
            self::MonthlyCheck => 'A quick look over the main things, once a month.',
            self::AnnualInspection => 'The thorough once-a-year going over, bumper to bumper.',
            self::BasicService => 'Oil, filters, fluids and a quick look over.',
            self::FullService => 'The long list, from engine bay to underbody.',
            self::SafetyCheck => 'Lights, brakes, steering, tyres and structure.',
            self::PrePurchase => 'What to look at before money changes hands.',
            self::TyresAndBrakes => 'Wear, pressures, pads, discs and lines.',
        };
    }

    /**
     * Get the checklist items, grouped by the section they belong to.
     *
     * @return array<string, array<int, string>>
     */
    public function sections(): array
    {
        return match ($this) {
            self::MonthlyCheck => [
                'Fluids' => [
                    'Engine oil level',
                    'Coolant level',
                    'Brake fluid level',
                    'Washer fluid level',
                    'No fresh leaks under the vehicle',
                ],
                'Tyres' => [
                    'Tyre pressures',
                    'Tread and sidewalls look okay',
                    'Wheel nuts all present',
                ],
                'Lights and glass' => [
                    'Headlights, indicators and brake lights',
                    'Windscreen free of new chips or cracks',
                    'Wipers and horn',
                ],
                'Walk around' => [
                    'Battery secure and terminals clean',
                    'No new body damage or rust',
                    'No warning lights on the dash',
                    'Brakes feel right on a short drive',
                ],
            ],
            self::AnnualInspection => [
                'Paperwork' => [
                    'Registration current',
                    'Insurance current',
                    'Service history up to date',
                    'Check for open recalls',
                ],
                'Engine bay' => [
                    'Oil level and condition',
                    'Coolant level, strength and hoses',
                    'Brake and clutch fluid condition',
                    'Power steering fluid and lines',
                    'Drive belts and tensioners',
                    'Battery load test and terminals',
                    'Air filter condition',
                    'Engine and gearbox mounts',
                    'Oil, coolant and fuel leaks',
                ],
                'Brakes' => [
                    'Front pads and discs',
                    'Rear pads, shoes, discs or drums',
                    'Brake lines and hoses',
                    'Handbrake holds on an incline',
                ],
                'Steering and suspension' => [
                    'Steering play and rack boots',
                    'Tie rod ends and ball joints',
                    'Shocks and springs',
                    'Suspension bushes',
                    'Wheel bearings free of play',
                ],
                'Wheels and tyres' => [
                    'Tread depth on every tyre',
                    'Sidewalls and wear pattern',
                    'Spare tyre, jack and wheel brace',
                    'Torque wheel nuts',
                ],
                'Underbody' => [
                    'CV boots and driveshafts',
                    'Gearbox and diff oil level',
                    'Exhaust system and mounts',
                    'Chassis and floor free of rust or damage',
                    'Fuel lines and tank',
                ],
                'Electrical and cabin' => [
                    'Every exterior light',
                    'Horn, wipers and washers',
                    'Dash warning lights and gauges',
                    'Scan for fault codes',
                    'Air conditioning and heater',
                    'Seatbelts latch and retract',
                    'Seats and mirrors secure',
                ],
                'Body and glass' => [
                    'Windscreen and windows',
                    'Doors, locks and latches',
                    'Body panels and paint',
                    'Safety gear on board',
                ],
                'Finish' => [
                    'Road test',
                    'Book in anything that needs work',
                ],
            ],
            self::BasicService => [
                'Engine bay' => [
                    'Drain and replace engine oil',
                    'Replace oil filter',
                    'Check coolant level and condition',
                    'Check brake fluid level',
                    'Check power steering fluid',
                    'Check drive belt condition and tension',
                    'Check battery terminals and charge',
                    'Top up windscreen washer fluid',
                ],
                'Filters' => [
                    'Inspect air filter',
                    'Inspect cabin filter',
                ],
                'Wheels' => [
                    'Check tyre pressures',
                    'Check tyre tread depth',
                    'Torque wheel nuts',
                ],
                'Finish' => [
                    'Reset service light',
                    'Road test',
                ],
            ],
            self::FullService => [
                'Engine bay' => [
                    'Drain and replace engine oil',
                    'Replace oil filter',
                    'Replace air filter',
                    'Replace fuel filter',
                    'Check spark plugs or glow plugs',
                    'Check coolant level, strength and hoses',
                    'Check brake and clutch fluid',
                    'Check power steering fluid and lines',
                    'Check drive belts and tensioners',
                    'Check battery, terminals and charging voltage',
                    'Check for oil and fluid leaks',
                ],
                'Brakes' => [
                    'Measure front pad thickness',
                    'Measure rear pad or shoe thickness',
                    'Inspect discs and drums for wear',
                    'Inspect brake lines and hoses',
                    'Check handbrake travel',
                ],
                'Wheels and tyres' => [
                    'Check tyre pressures',
                    'Check tread depth and wear pattern',
                    'Inspect sidewalls for damage',
                    'Check spare tyre and jack',
                    'Torque wheel nuts',
                ],
                'Underbody' => [
                    'Inspect suspension bushes and shocks',
                    'Inspect steering rack and tie rod ends',
                    'Inspect CV boots and driveshafts',
                    'Inspect exhaust system and mounts',
                    'Check gearbox and diff oil',
                ],
                'Electrical and cabin' => [
                    'Check headlights, indicators and brake lights',
                    'Check horn and wipers',
                    'Replace cabin filter',
                    'Check air conditioning operation',
                    'Scan for fault codes',
                ],
                'Finish' => [
                    'Reset service light',
                    'Road test',
                    'Record next service due',
                ],
            ],
            self::SafetyCheck => [
                'Lights and visibility' => [
                    'Headlights high and low beam',
                    'Indicators and hazard lights',
                    'Brake lights and reverse lights',
                    'Windscreen condition',
                    'Wiper blades and washers',
                    'Mirrors secure and undamaged',
                ],
                'Brakes and steering' => [
                    'Brake pad and disc condition',
                    'Brake pedal feel and travel',
                    'Handbrake holds on an incline',
                    'Steering play and alignment',
                    'Suspension and shock condition',
                ],
                'Tyres and wheels' => [
                    'Tread depth above legal limit',
                    'No sidewall damage or bulges',
                    'Correct pressures',
                    'Wheel bearings free of play',
                ],
                'Structure and restraints' => [
                    'Seatbelts latch and retract',
                    'Seats secure',
                    'No structural rust or damage',
                    'Exhaust free of leaks',
                    'Horn works',
                ],
            ],
            self::PrePurchase => [
                'Paperwork' => [
                    'VIN matches paperwork',
                    'Service history present',
                    'Odometer reading looks consistent',
                    'Registration current',
                ],
                'Body' => [
                    'Panel gaps even',
                    'Paint match across panels',
                    'Check for rust and previous repairs',
                    'Glass and lights undamaged',
                ],
                'Mechanical' => [
                    'Cold start behaviour',
                    'Check for smoke from exhaust',
                    'Listen for engine noise',
                    'Check for oil and coolant leaks',
                    'Check oil condition on the dipstick',
                    'Gearbox shifts cleanly',
                    'Clutch bite point',
                ],
                'Road test' => [
                    'Brakes pull up straight',
                    'Steering tracks straight',
                    'No vibration at speed',
                    'Suspension quiet over bumps',
                    'Scan for fault codes',
                ],
            ],
            self::TyresAndBrakes => [
                'Tyres' => [
                    'Front left tread and pressure',
                    'Front right tread and pressure',
                    'Rear left tread and pressure',
                    'Rear right tread and pressure',
                    'Sidewalls free of damage',
                    'Spare tyre condition',
                ],
                'Brakes' => [
                    'Front pad thickness',
                    'Rear pad or shoe thickness',
                    'Front disc condition',
                    'Rear disc or drum condition',
                    'Brake lines and hoses',
                    'Brake fluid level and condition',
                    'Handbrake adjustment',
                ],
                'Finish' => [
                    'Torque wheel nuts',
                    'Road test brakes',
                ],
            ],
        };
    }

    /**
     * Determine whether the checklist ticks off a vehicle's monthly check.
     *
     * The annual inspection covers everything the monthly check does, so
     * the month it is run in needs nothing more.
     */
    public function coversMonthlyCheck(): bool
    {
        return $this === self::MonthlyCheck || $this === self::AnnualInspection;
    }

    /**
     * Get the number of items the checklist contains.
     */
    public function itemCount(): int
    {
        return array_sum(array_map('count', $this->sections()));
    }

    /**
     * Get every checklist as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $template): array => ['value' => $template->value, 'label' => $template->label()],
            self::cases(),
        );
    }

    /**
     * Get every checklist with its description and size, for the picker screen.
     *
     * @return array<int, array{value: string, label: string, description: string, item_count: int}>
     */
    public static function catalog(): array
    {
        return array_map(
            fn (self $template): array => [
                'value' => $template->value,
                'label' => $template->label(),
                'description' => $template->description(),
                'item_count' => $template->itemCount(),
            ],
            self::cases(),
        );
    }
}
