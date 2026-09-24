<?php

namespace App\Enums;

enum MachineKind: string
{
    case Car = 'car';
    case Ute = 'ute';
    case Suv = 'suv';
    case Van = 'van';
    case Truck = 'truck';
    case Bus = 'bus';
    case Motorcycle = 'motorcycle';
    case Atv = 'atv';
    case Tractor = 'tractor';
    case Mower = 'mower';
    case Outboard = 'outboard';
    case Generator = 'generator';
    case Trailer = 'trailer';
    case Other = 'other';

    /**
     * Get the human readable label for the kind of machine.
     */
    public function label(): string
    {
        return match ($this) {
            self::Car => 'Car',
            self::Ute => 'Ute / pickup',
            self::Suv => 'SUV / 4WD',
            self::Van => 'Van',
            self::Truck => 'Truck',
            self::Bus => 'Bus',
            self::Motorcycle => 'Motorcycle',
            self::Atv => 'ATV / side-by-side',
            self::Tractor => 'Tractor',
            self::Mower => 'Ride-on mower',
            self::Outboard => 'Outboard motor',
            self::Generator => 'Generator / stationary engine',
            self::Trailer => 'Trailer',
            self::Other => 'Other machine',
        };
    }

    /**
     * Whether the machine has an engine to show and service.
     */
    public function hasEngine(): bool
    {
        return $this !== self::Trailer;
    }

    /**
     * Work out the kind of machine from what the VIN decoder calls it.
     *
     * NHTSA describes a body class ("Pickup", "Sport Utility Vehicle (SUV)")
     * and a broader vehicle type ("MOTORCYCLE", "TRUCK"). The body class is
     * more specific so it wins, and the type fills in when the body class is
     * blank or unhelpful.
     */
    public static function fromBodyClass(?string $bodyClass, ?string $vehicleType = null): self
    {
        $body = strtolower((string) $bodyClass);
        $type = strtolower((string) $vehicleType);

        return match (true) {
            str_contains($body, 'motorcycle'), str_contains($body, 'scooter'), str_contains($type, 'motorcycle') => self::Motorcycle,
            str_contains($body, 'all terrain'), str_contains($body, 'atv'), str_contains($body, 'off-road'), str_contains($type, 'off road') => self::Atv,
            str_contains($body, 'tractor'), str_contains($body, 'agricultur') => self::Tractor,
            str_contains($body, 'trailer'), str_contains($type, 'trailer') => self::Trailer,
            str_contains($body, 'bus'), str_contains($type, 'bus') => self::Bus,
            str_contains($body, 'pickup') => self::Ute,
            str_contains($body, 'sport utility'), str_contains($body, 'suv'), str_contains($body, 'crossover'), str_contains($body, 'multipurpose') => self::Suv,
            str_contains($body, 'van'), str_contains($body, 'minivan') => self::Van,
            str_contains($body, 'truck'), str_contains($body, 'cab chassis'), str_contains($body, 'incomplete') => self::Truck,
            str_contains($body, 'sedan'), str_contains($body, 'coupe'), str_contains($body, 'hatchback'), str_contains($body, 'wagon'), str_contains($body, 'convertible'), str_contains($body, 'roadster') => self::Car,
            str_contains($type, 'passenger') => self::Car,
            str_contains($type, 'truck') => self::Truck,
            default => self::Other,
        };
    }

    /**
     * Get every kind as a select option.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $kind): array => ['value' => $kind->value, 'label' => $kind->label()],
            self::cases(),
        );
    }

    /**
     * Get the service schedule for this kind of machine.
     *
     * Intervals are the conservative manufacturer-agnostic ones a workshop
     * would use when the book is not to hand. Diesel and petrol differ on
     * fuel system items, so the fuel type tunes the list.
     *
     * @return array<int, array{interval: string, items: array<int, string>}>
     */
    public function maintenanceSchedule(?string $fuel = null): array
    {
        $isDiesel = str_contains(strtolower((string) $fuel), 'diesel');
        $isElectric = str_contains(strtolower((string) $fuel), 'electric');

        if ($isElectric && in_array($this, [self::Car, self::Ute, self::Suv, self::Van], true)) {
            return [
                ['interval' => 'Every 12 months or 15,000 km', 'items' => [
                    'Rotate tyres and check pressures',
                    'Inspect brake pads, discs and fluid (regen braking hides wear)',
                    'Replace cabin air filter',
                    'Check 12 V auxiliary battery',
                    'Inspect coolant level for the battery and motor loop',
                ]],
                ['interval' => 'Every 2 years', 'items' => [
                    'Replace brake fluid',
                    'Inspect high voltage cables and connectors for chafe',
                ]],
                ['interval' => 'Every 4 years or 80,000 km', 'items' => [
                    'Replace battery and drive unit coolant',
                    'Replace reduction gearbox oil where serviceable',
                ]],
            ];
        }

        return match ($this) {
            self::Car, self::Ute, self::Suv, self::Van => [
                ['interval' => 'Every 6 months or 10,000 km', 'items' => [
                    'Replace engine oil and filter',
                    'Check and top up coolant, brake, power steering and washer fluid',
                    'Inspect tyres, pressures and tread',
                    'Check lights, wipers and horn',
                    $isDiesel ? 'Drain the water trap on the fuel filter' : 'Inspect air filter',
                ]],
                ['interval' => 'Every 12 months or 20,000 km', 'items' => [
                    'Replace air filter',
                    'Replace cabin filter',
                    $isDiesel ? 'Replace fuel filter' : 'Inspect fuel lines and vapour hoses',
                    'Inspect brake pads, discs and handbrake adjustment',
                    'Inspect drive belts, hoses and battery terminals',
                    'Rotate tyres and check wheel alignment',
                ]],
                ['interval' => 'Every 2 years or 40,000 km', 'items' => [
                    'Replace brake fluid',
                    $isDiesel ? 'Check glow plugs and EGR for carbon build-up' : 'Replace spark plugs (copper)',
                    'Replace differential and transfer case oil (4WD)',
                    'Inspect suspension bushes, ball joints and CV boots',
                ]],
                ['interval' => 'Every 5 years or 100,000 km', 'items' => [
                    'Replace coolant',
                    'Replace timing belt and tensioner (belt-driven engines)',
                    'Replace automatic transmission fluid and filter',
                    $isDiesel ? 'Clean or replace DPF and check injectors' : 'Replace spark plugs (iridium) and inspect ignition coils',
                ]],
            ],
            self::Truck, self::Bus => [
                ['interval' => 'Every 250 hours or 10,000 km', 'items' => [
                    'Replace engine oil and filters',
                    'Drain fuel water separator',
                    'Grease chassis, kingpins and driveline',
                    'Check air system for leaks and drain air tanks',
                    'Inspect brake linings and slack adjusters',
                ]],
                ['interval' => 'Every 500 hours or 40,000 km', 'items' => [
                    'Replace fuel filters',
                    'Replace air filter',
                    'Inspect wheel bearings and hub oil',
                    'Check wheel nut torque and tyre wear pattern',
                ]],
                ['interval' => 'Every 12 months', 'items' => [
                    'Replace air dryer cartridge',
                    'Inspect turbo, intercooler and charge pipes',
                    'Check valve clearances',
                    'Test coolant additive level',
                ]],
                ['interval' => 'Every 2 years', 'items' => [
                    'Replace coolant',
                    'Replace gearbox and differential oil',
                ]],
            ],
            self::Motorcycle => [
                ['interval' => 'Every 500 km', 'items' => [
                    'Clean, lubricate and adjust the chain',
                    'Check tyre pressures',
                ]],
                ['interval' => 'Every 6,000 km or 6 months', 'items' => [
                    'Replace engine oil and filter',
                    'Inspect brake pads and fluid',
                    'Inspect air filter',
                    'Check clutch and throttle cable free play',
                    'Check chain and sprocket wear',
                ]],
                ['interval' => 'Every 12,000 km or 12 months', 'items' => [
                    'Replace spark plugs',
                    'Replace air filter',
                    'Check valve clearances',
                    'Inspect fork seals and steering head bearings',
                    'Inspect wheel bearings',
                ]],
                ['interval' => 'Every 2 years', 'items' => [
                    'Replace brake fluid',
                    'Replace coolant (liquid cooled)',
                    'Replace fork oil',
                ]],
            ],
            self::Atv => [
                ['interval' => 'Every 25 hours', 'items' => [
                    'Clean air filter and airbox',
                    'Check tyre pressures and lug nuts',
                    'Grease suspension and steering fittings',
                    'Inspect CV boots for tears',
                ]],
                ['interval' => 'Every 50 hours or 6 months', 'items' => [
                    'Replace engine oil and filter',
                    'Inspect brake pads and fluid',
                    'Inspect drive belt (CVT) for glazing or cracks',
                    'Check coolant level and radiator for mud',
                ]],
                ['interval' => 'Every 100 hours or 12 months', 'items' => [
                    'Replace spark plug',
                    'Replace front and rear differential oil',
                    'Check valve clearances',
                    'Inspect wheel bearings and ball joints',
                ]],
            ],
            self::Tractor => [
                ['interval' => 'Every 10 hours or daily', 'items' => [
                    'Check engine oil and coolant',
                    'Check hydraulic oil level',
                    'Clean radiator screen and air pre-cleaner',
                    'Grease all fittings',
                ]],
                ['interval' => 'Every 100 hours', 'items' => [
                    'Replace engine oil and filter',
                    'Drain fuel water separator',
                    'Check tyre pressures and wheel nut torque',
                    'Check fan and alternator belt tension',
                ]],
                ['interval' => 'Every 300 hours', 'items' => [
                    'Replace fuel filters',
                    'Replace air filter elements',
                    'Replace hydraulic and transmission filters',
                    'Check clutch and brake adjustment',
                ]],
                ['interval' => 'Every 600 hours or 2 years', 'items' => [
                    'Replace hydraulic and transmission oil',
                    'Replace coolant',
                    'Check valve clearances',
                    'Inspect PTO clutch and driveline',
                ]],
            ],
            self::Mower => [
                ['interval' => 'Every 8 hours or after each use', 'items' => [
                    'Check engine oil level',
                    'Clean grass from deck, cooling fins and around the muffler',
                    'Inspect blades for damage',
                ]],
                ['interval' => 'Every 25 hours', 'items' => [
                    'Clean or replace air filter (more often in dust)',
                    'Sharpen and balance blades',
                    'Check tyre pressures',
                    'Grease spindles, wheel bearings and pivots',
                ]],
                ['interval' => 'Every 50 hours or each season', 'items' => [
                    'Replace engine oil and filter',
                    'Replace spark plug',
                    'Replace fuel filter',
                    'Inspect deck and drive belts',
                    'Check battery and charging voltage',
                ]],
                ['interval' => 'Every 100 hours', 'items' => [
                    'Replace hydrostatic transmission oil and filter',
                    'Check valve clearances',
                    'Inspect deck spindle bearings',
                ]],
            ],
            self::Outboard => [
                ['interval' => 'After every saltwater use', 'items' => [
                    'Flush cooling system with fresh water',
                    'Check the tell-tale water stream',
                    'Rinse and spray corrosion inhibitor on the powerhead',
                ]],
                ['interval' => 'Every 100 hours or each season', 'items' => [
                    'Replace gear case oil and check for milky oil (water ingress)',
                    'Replace engine oil and filter (four stroke)',
                    'Replace fuel filter and inspect primer bulb',
                    'Replace spark plugs',
                    'Grease propeller shaft and check for fishing line',
                    'Inspect sacrificial anodes and replace at 50% wear',
                ]],
                ['interval' => 'Every 300 hours or 3 years', 'items' => [
                    'Replace water pump impeller',
                    'Replace thermostat',
                    'Check valve clearances',
                    'Inspect timing belt (four stroke)',
                ]],
            ],
            self::Generator => [
                ['interval' => 'Every 8 hours or before each use', 'items' => [
                    'Check engine oil level',
                    'Check fuel for water and stale petrol',
                    'Inspect for leaks and loose fasteners',
                ]],
                ['interval' => 'Every 50 hours', 'items' => [
                    'Clean air filter',
                    'Check and clean spark arrestor',
                    'Check battery (electric start)',
                ]],
                ['interval' => 'Every 100 hours or each season', 'items' => [
                    'Replace engine oil',
                    'Replace spark plug',
                    'Replace fuel filter',
                    'Check valve clearances',
                    'Load test the alternator output',
                ]],
                ['interval' => 'Storage', 'items' => [
                    'Run dry or add fuel stabiliser',
                    'Run monthly under load for 30 minutes',
                ]],
            ],
            self::Trailer => [
                ['interval' => 'Before each trip', 'items' => [
                    'Check lights, coupling, safety chains and breakaway',
                    'Check tyre pressures and wheel nut torque',
                ]],
                ['interval' => 'Every 12 months or 10,000 km', 'items' => [
                    'Repack wheel bearings',
                    'Inspect brake shoes, magnets and adjusters',
                    'Inspect suspension springs, shackles and bushes',
                    'Check coupling wear and hitch bolt torque',
                    'Inspect chassis for cracks and corrosion',
                ]],
            ],
            self::Other => [
                ['interval' => 'Every 50 hours or 6 months', 'items' => [
                    'Replace engine oil and filter',
                    'Clean or replace air filter',
                    'Inspect fuel lines and filter',
                    'Check battery and charging',
                ]],
                ['interval' => 'Every 12 months', 'items' => [
                    'Replace spark or glow plugs',
                    'Replace fuel filter',
                    'Check valve clearances',
                    'Inspect belts, hoses and cooling',
                ]],
            ],
        };
    }

    /**
     * Get the repairs this kind of machine commonly comes into the shop for.
     *
     * @return array<int, array{symptom: string, causes: array<int, string>, fix: string}>
     */
    public function commonRepairs(): array
    {
        $engine = [
            [
                'symptom' => 'Hard to start or cranks without firing',
                'causes' => ['Weak battery or corroded terminals', 'Failed crank or cam sensor', 'Fuel pump or filter starved', 'Worn starter'],
                'fix' => 'Check battery voltage under crank (above 9.6 V), listen for the fuel pump prime, then read codes before replacing parts.',
            ],
            [
                'symptom' => 'Overheating or coolant loss',
                'causes' => ['Stuck thermostat', 'Failed radiator fan or clutch', 'Leaking radiator, hose or water pump', 'Head gasket'],
                'fix' => 'Pressure test the system cold, confirm fan operation at temperature, and check for combustion gas in the coolant before pulling the head.',
            ],
            [
                'symptom' => 'Rough idle or misfire',
                'causes' => ['Worn spark plugs or coils', 'Vacuum leak', 'Dirty injectors', 'Low compression on one cylinder'],
                'fix' => 'Swap the suspect coil to another cylinder and see if the misfire follows it; smoke test for leaks; do a compression test if it stays.',
            ],
        ];

        return match ($this) {
            self::Car, self::Ute, self::Suv, self::Van => [
                ...$engine,
                [
                    'symptom' => 'Brake squeal, judder or long pedal',
                    'causes' => ['Pads down to the wear indicator', 'Warped or heat-spotted discs', 'Seized caliper slide pin', 'Air or moisture in the fluid'],
                    'fix' => 'Measure pad and disc thickness against minimums, free and grease slide pins, and bleed with fresh fluid if the pedal is soft.',
                ],
                [
                    'symptom' => 'Clunk or knock over bumps',
                    'causes' => ['Sway bar links', 'Control arm bushes', 'Worn strut mount', 'Loose exhaust hanger'],
                    'fix' => 'Lift the vehicle, pry each joint with a bar and feel for play. Sway bar links are the usual culprit and cheap.',
                ],
                [
                    'symptom' => 'Battery warning or dim lights',
                    'causes' => ['Alternator diode or brushes', 'Slipping drive belt', 'Corroded earth strap'],
                    'fix' => 'Check charging voltage at idle (13.8 to 14.6 V) and with load; a reading that drops is the alternator, a noisy belt is the tensioner.',
                ],
            ],
            self::Truck, self::Bus => [
                ...$engine,
                [
                    'symptom' => 'Air brake pressure slow to build or drops overnight',
                    'causes' => ['Leaking air line or valve', 'Worn compressor', 'Failed air dryer purge valve'],
                    'fix' => 'Soap test every fitting with the system charged. Loss over 2 psi per minute with the brakes applied fails a roadworthy.',
                ],
                [
                    'symptom' => 'Low power or black smoke',
                    'causes' => ['Blocked air filter', 'Boost leak from a charge pipe', 'Turbo wear', 'Injector'],
                    'fix' => 'Check the restriction indicator, pressure test the charge system, and log boost against spec under load.',
                ],
            ],
            self::Motorcycle => [
                ...$engine,
                [
                    'symptom' => 'Chain noise, tight spots or rear wheel hop',
                    'causes' => ['Chain stretched past its wear limit', 'Hooked sprocket teeth', 'Chain adjusted too tight'],
                    'fix' => 'Replace chain and both sprockets as a set and set slack to spec with the suspension loaded.',
                ],
                [
                    'symptom' => 'Fork leaking oil',
                    'causes' => ['Torn fork seal', 'Pitted stanchion'],
                    'fix' => 'Try a seal cleaner tool first; replace seals and dust boots together and check the stanchion for pits that will cut the new seal.',
                ],
            ],
            self::Atv => [
                ...$engine,
                [
                    'symptom' => 'Belt slip, squeal or loss of drive',
                    'causes' => ['Glazed or worn CVT belt', 'Water in the clutch housing', 'Worn clutch sheaves or rollers'],
                    'fix' => 'Drain the belt housing, measure belt width against the wear limit, and scuff or replace the sheaves.',
                ],
                [
                    'symptom' => 'Grinding or clicking from a wheel',
                    'causes' => ['Torn CV boot let the grease out', 'Wheel bearing', 'Worn ball joint'],
                    'fix' => 'Spin each wheel off the ground and rock it top to bottom; replace the CV axle or bearing before it takes the hub with it.',
                ],
            ],
            self::Tractor => [
                ...$engine,
                [
                    'symptom' => 'Hydraulics slow, weak or lift drops under load',
                    'causes' => ['Low or contaminated hydraulic oil', 'Blocked suction filter', 'Worn pump', 'Leaking lift cylinder seals'],
                    'fix' => 'Check oil level and condition first, then replace the filters. A pump that only struggles when hot is worn.',
                ],
                [
                    'symptom' => 'PTO will not engage or slips',
                    'causes' => ['Worn PTO clutch pack', 'Low transmission oil', 'Faulty PTO switch or solenoid'],
                    'fix' => 'Confirm oil level and pressure, then test the solenoid electrically before splitting the tractor.',
                ],
            ],
            self::Mower => [
                [
                    'symptom' => 'Will not start or dies after a few seconds',
                    'causes' => ['Stale fuel and gummed carburettor', 'Safety interlock switch (seat, brake, PTO)', 'Flat battery', 'Fouled spark plug'],
                    'fix' => 'Test the interlock switches first, then check for spark and drain old fuel. Most carburettor faults are the main jet.',
                ],
                [
                    'symptom' => 'Uneven cut or excessive vibration',
                    'causes' => ['Bent or unbalanced blade', 'Worn spindle bearing', 'Deck out of level', 'Low tyre on one side'],
                    'fix' => 'Check tyre pressures, level the deck front to back and side to side, then spin each spindle by hand for roughness.',
                ],
                [
                    'symptom' => 'Loses drive on hills or when hot',
                    'causes' => ['Old hydrostatic oil', 'Worn drive belt', 'Air in the hydro unit'],
                    'fix' => 'Replace the drive belt if glazed, then change the hydro oil and purge it per the transaxle procedure.',
                ],
                [
                    'symptom' => 'Battery goes flat between uses',
                    'causes' => ['Failed stator or regulator', 'Parasitic drain', 'Sulphated battery'],
                    'fix' => 'Check charging voltage at 3/4 throttle (above 13.5 V). No charge points to the regulator or stator.',
                ],
            ],
            self::Outboard => [
                [
                    'symptom' => 'Weak or no tell-tale water stream',
                    'causes' => ['Worn water pump impeller', 'Blocked tell-tale outlet', 'Stuck thermostat'],
                    'fix' => 'Clear the tell-tale with wire first; if still weak replace the impeller and check the pump housing for scoring.',
                ],
                [
                    'symptom' => 'Milky gear oil',
                    'causes' => ['Prop shaft seal cut by fishing line', 'Drive shaft seal', 'Cracked gear case'],
                    'fix' => 'Pressure and vacuum test the gear case, replace the seals and refill. Never leave water in over winter.',
                ],
                [
                    'symptom' => 'Hesitation or stalling at low speed',
                    'causes' => ['Stale fuel and varnished carburettor or injectors', 'Cracked primer bulb', 'Water in the fuel'],
                    'fix' => 'Check the fuel water separator, then clean the carburettor idle circuit or run injector cleaner.',
                ],
            ],
            self::Generator => [
                [
                    'symptom' => 'Runs but no output',
                    'causes' => ['Lost residual magnetism', 'Failed AVR or capacitor', 'Tripped breaker', 'Open winding'],
                    'fix' => 'Reset breakers, then flash the field to restore magnetism. Test the capacitor or AVR before condemning the windings.',
                ],
                [
                    'symptom' => 'Surging or hunting idle',
                    'causes' => ['Blocked carburettor pilot jet', 'Governor linkage sticking', 'Air leak at the intake'],
                    'fix' => 'Clean the pilot jet, free the governor linkage and check the intake gasket with a little carburettor cleaner spray.',
                ],
                [
                    'symptom' => 'Hard to start after storage',
                    'causes' => ['Stale fuel', 'Fouled spark plug', 'Low oil shutdown sensor'],
                    'fix' => 'Drain and replace fuel, clean the plug and confirm the oil level. Add a stabiliser before the next storage.',
                ],
            ],
            self::Trailer => [
                [
                    'symptom' => 'Hot hub or wheel wobble',
                    'causes' => ['Dry or over-tight wheel bearing', 'Failed grease seal', 'Brake dragging'],
                    'fix' => 'Repack bearings, replace seals and set preload to a whisker of play. Check brake adjusters back off.',
                ],
                [
                    'symptom' => 'Lights intermittent or missing',
                    'causes' => ['Corroded plug pins', 'Bad chassis earth', 'Chafed wiring'],
                    'fix' => 'Clean the plug and run a dedicated earth wire to each lamp instead of relying on the chassis.',
                ],
            ],
            self::Other => $engine,
        };
    }
}
