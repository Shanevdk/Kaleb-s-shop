/**
 * The parts of the engine the 3D model lets you click on, and what to tell a
 * mechanic about each one.
 */
export type EnginePartKey =
    | 'block'
    | 'head'
    | 'intake'
    | 'exhaust'
    | 'turbo'
    | 'airbox'
    | 'alternator'
    | 'belt'
    | 'sump'
    | 'starter'
    | 'flywheel'
    | 'radiator'
    | 'fins'
    | 'fuel'
    | 'filter';

export type EnginePart = {
    label: string;
    does: string;
    watch: string;
};

export const ENGINE_PARTS: Record<EnginePartKey, EnginePart> = {
    block: {
        label: 'Engine block',
        does: 'The cast body that holds the cylinders, crankshaft and pistons. Everything else bolts to it.',
        watch: 'Coolant weeping from core plugs, oil at the block-to-sump join, and cracks around freeze plugs after a hard winter.',
    },
    head: {
        label: 'Cylinder head and valve cover',
        does: 'Sits on top of the block with the valves, camshafts and spark or glow plugs. The rocker cover keeps the oil in.',
        watch: 'Oil leaks from the rocker cover gasket are the usual first job. Milky oil or bubbles in the coolant point to the head gasket.',
    },
    intake: {
        label: 'Intake manifold',
        does: 'Splits the filtered air (and on port injection, the fuel) between the cylinders.',
        watch: 'Vacuum leaks at the gasket cause a rough idle and lean codes. Diesel intakes clog with soot from the EGR.',
    },
    exhaust: {
        label: 'Exhaust manifold',
        does: 'Collects the burnt gases from every cylinder into one pipe and, on a turbo engine, feeds the turbine.',
        watch: 'A ticking noise on cold start is a cracked manifold or a broken stud. Check for blue heat marks.',
    },
    turbo: {
        label: 'Turbocharger',
        does: 'Exhaust spins a turbine that drives a compressor, forcing more air into the engine for more power.',
        watch: 'Shaft play, oil in the intercooler pipes, and a whistle or whine that changes with boost. Always let it idle down after a hard run.',
    },
    airbox: {
        label: 'Air filter and airbox',
        does: 'Cleans the air before it reaches the intake. A blocked filter chokes the engine.',
        watch: 'Replace more often in dust. Check the ducting for splits that let dirt past the filter.',
    },
    alternator: {
        label: 'Alternator',
        does: 'Driven by the belt, it charges the battery and runs the electrics while the engine is going.',
        watch: 'Charging should read 13.8 to 14.6 V at idle. A whine, a battery light, or dim lights at idle mean it is on its way out.',
    },
    belt: {
        label: 'Drive belt and pulleys',
        does: 'Turns the alternator, water pump, power steering and air conditioning from the crank pulley.',
        watch: 'Cracks across the ribs, glazing, and squeal on cold start. Check the tensioner and idler bearings while it is off.',
    },
    sump: {
        label: 'Oil sump',
        does: 'The oil pan at the bottom of the engine. The pump draws oil from here to feed the bearings and cams.',
        watch: 'Drain plug threads, gasket leaks, and dents from rocks on off-road machines. Check the level with the machine on flat ground.',
    },
    starter: {
        label: 'Starter motor',
        does: 'A small electric motor that spins the flywheel to get the engine going.',
        watch: 'A single click with a good battery is the solenoid or a bad earth. Grinding is a worn pinion or ring gear.',
    },
    flywheel: {
        label: 'Flywheel and bell housing',
        does: 'The heavy disc on the back of the crank that smooths the engine and carries the clutch or torque converter.',
        watch: 'Judder on take-off, a rattle at idle that goes when the clutch is pressed, or a rear main seal leak into the housing.',
    },
    radiator: {
        label: 'Radiator and cooling fan',
        does: 'Sheds heat from the coolant. The fan pulls air through when the machine is not moving.',
        watch: 'Bent or clogged fins, green or brown crust at the tanks, and a fan that does not come on at temperature.',
    },
    fins: {
        label: 'Cooling fins and shroud',
        does: 'On an air cooled engine the flywheel fan blows air over these fins to keep the cylinder cool.',
        watch: 'Grass, dust and mouse nests packed in the fins will cook the engine. Clean them every service.',
    },
    fuel: {
        label: 'Fuel rail and injectors',
        does: 'The rail holds fuel under pressure and each injector sprays a measured shot into its cylinder.',
        watch: 'A misfire on one cylinder that swaps with the injector, fuel smell at the rail seals, or a diesel that smokes and rattles after an injector fails.',
    },
    filter: {
        label: 'Oil filter',
        does: 'Traps the grit and metal the oil picks up before it goes back round the bearings.',
        watch: 'Change it with every oil change. Pre-fill it where you can, and check the old gasket came off with it.',
    },
};

export const ENGINE_PART_KEYS = Object.keys(ENGINE_PARTS) as EnginePartKey[];
