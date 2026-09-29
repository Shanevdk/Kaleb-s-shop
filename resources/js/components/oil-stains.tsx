import { useEffect, useId, useState } from 'react';

type Point = [number, number];

type Stain = {
    left: number;
    top: number;
    size: number;
    rotation: number;
    stretch: number;
    strength: number;
    puddle: string;
    sheen: string;
    drops: { x: number; y: number; r: number }[];
};

const between = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Draw a closed, lumpy outline in a 100 x 100 box, the shape a puddle of oil
 * soaks into concrete.
 */
function blob(radius: number, lumpiness: number, points: number): string {
    const outline: Point[] = Array.from({ length: points }, (_, index) => {
        const angle = (index / points) * Math.PI * 2 + between(-0.15, 0.15);
        const reach = radius * between(1 - lumpiness, 1 + lumpiness);

        return [50 + Math.cos(angle) * reach, 50 + Math.sin(angle) * reach];
    });

    const midpoint = (a: Point, b: Point): Point => [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
    ];
    const start = midpoint(outline[outline.length - 1], outline[0]);

    return (
        outline.reduce(
            (path, point, index) => {
                const end = midpoint(
                    point,
                    outline[(index + 1) % outline.length],
                );

                return `${path} Q ${point[0].toFixed(1)} ${point[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
            },
            `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`,
        ) + ' Z'
    );
}

function makeStain(): Stain {
    return {
        left: between(-5, 95),
        top: between(-5, 95),
        size: between(60, 260),
        rotation: between(0, 360),
        stretch: between(1, 1.7),
        strength: between(0.6, 1),
        puddle: blob(34, 0.22, Math.round(between(9, 14))),
        sheen: blob(20, 0.3, Math.round(between(7, 10))),
        drops: Array.from({ length: Math.round(between(0, 4)) }, () => {
            const angle = between(0, Math.PI * 2);
            const distance = between(40, 49);

            return {
                x: 50 + Math.cos(angle) * distance,
                y: 50 + Math.sin(angle) * distance,
                r: between(0.8, 2.6),
            };
        }),
    };
}

/**
 * Faint oil stains dropped at random behind the page, like the floor of the
 * workshop. They are laid down once the page is in the browser, so every
 * visit gets its own mess.
 */
export default function OilStains({ count = 8 }: { count?: number }) {
    const id = useId();
    const [stains, setStains] = useState<Stain[]>([]);

    useEffect(() => {
        setStains(Array.from({ length: count }, makeStain));
    }, [count]);

    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] text-stone-950 [--oil-alpha:0.11] [--oil-sheen:0.05] dark:text-black dark:[--oil-alpha:0.6] dark:[--oil-sheen:0.1] print:hidden"
        >
            {stains.map((stain, index) => {
                const core = `${id}-core-${index}`;
                const sheen = `${id}-sheen-${index}`;

                return (
                    <svg
                        key={index}
                        viewBox="0 0 100 100"
                        className="absolute"
                        style={{
                            left: `${stain.left}%`,
                            top: `${stain.top}%`,
                            width: stain.size,
                            height: stain.size,
                            opacity: stain.strength,
                            transform: `rotate(${stain.rotation}deg) scaleX(${stain.stretch})`,
                        }}
                    >
                        <defs>
                            <radialGradient id={core} cx="45%" cy="48%" r="60%">
                                <stop
                                    offset="0%"
                                    stopColor="currentColor"
                                    style={{ stopOpacity: 'var(--oil-alpha)' }}
                                />
                                <stop
                                    offset="70%"
                                    stopColor="currentColor"
                                    style={{
                                        stopOpacity:
                                            'calc(var(--oil-alpha) * 0.75)',
                                    }}
                                />
                                <stop
                                    offset="100%"
                                    stopColor="currentColor"
                                    style={{
                                        stopOpacity:
                                            'calc(var(--oil-alpha) * 1.3)',
                                    }}
                                />
                            </radialGradient>
                            <linearGradient
                                id={sheen}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                            >
                                <stop
                                    offset="0%"
                                    stopColor="#7c5cff"
                                    style={{ stopOpacity: 'var(--oil-sheen)' }}
                                />
                                <stop
                                    offset="50%"
                                    stopColor="#1fb5a8"
                                    style={{ stopOpacity: 'var(--oil-sheen)' }}
                                />
                                <stop
                                    offset="100%"
                                    stopColor="#e0a526"
                                    style={{ stopOpacity: 'var(--oil-sheen)' }}
                                />
                            </linearGradient>
                        </defs>

                        <path d={stain.puddle} fill={`url(#${core})`} />
                        <path
                            d={stain.sheen}
                            fill={`url(#${sheen})`}
                            transform="translate(-6 -4)"
                        />
                        {stain.drops.map((drop, dropIndex) => (
                            <circle
                                key={dropIndex}
                                cx={drop.x}
                                cy={drop.y}
                                r={drop.r}
                                fill="currentColor"
                                style={{ fillOpacity: 'var(--oil-alpha)' }}
                            />
                        ))}
                    </svg>
                );
            })}
        </div>
    );
}
