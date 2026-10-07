import type { SVGAttributes } from 'react';

/**
 * The flag is drawn to its official proportions with the hoist 1300 units
 * tall, so each of the thirteen stripes is 100, and 1.9 of the hoist long.
 * The canton is seven stripes deep and 0.76 of the hoist wide, and the
 * stars sit 0.054 of the hoist apart down and 0.063 across.
 */
const HOIST = 1300;
const FLY = 2470;
const STRIPE = 100;
const CANTON_WIDTH = 988;
const CANTON_HEIGHT = 700;
const STAR_RADIUS = 40;
const STAR_ROW_GAP = 70;
const STAR_COLUMN_GAP = 82.33;

/** The six white stripes, every other one from the second down. */
const WHITE_STRIPES = Array.from(
    { length: 6 },
    (_, stripe) => `M0 ${(stripe * 2 + 1) * STRIPE}h${FLY}v${STRIPE}H0z`,
).join('');

/**
 * A five-pointed star centred on the given point, one point straight up.
 */
function star(x: number, y: number): string {
    const corners = Array.from({ length: 10 }, (_, corner) => {
        const radius = corner % 2 === 0 ? STAR_RADIUS : STAR_RADIUS * 0.382;
        const angle = (Math.PI / 5) * corner - Math.PI / 2;

        return `${(x + radius * Math.cos(angle)).toFixed(1)} ${(y + radius * Math.sin(angle)).toFixed(1)}`;
    });

    return `M${corners.join('L')}Z`;
}

/** The fifty stars, in nine rows of six and five turn about. */
const STARS = Array.from({ length: 9 }, (_, row) => {
    const isRowOfSix = row % 2 === 0;

    return Array.from({ length: isRowOfSix ? 6 : 5 }, (_, column) =>
        star(
            STAR_COLUMN_GAP * (column * 2 + (isRowOfSix ? 1 : 2)),
            STAR_ROW_GAP * (row + 1),
        ),
    ).join('');
}).join('');

/**
 * The American flag. By default it is cut square from the hoist end to fit
 * a brand mark: the whole canton with its fifty stars, and the stripes
 * beside and below it. `whole` draws the full length of the flag.
 */
export default function AmericanFlag({
    whole = false,
    ...props
}: SVGAttributes<SVGElement> & { whole?: boolean }) {
    return (
        <svg
            {...props}
            viewBox={`0 0 ${whole ? FLY : HOIST} ${HOIST}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect width={FLY} height={HOIST} fill="#b22234" />
            <path d={WHITE_STRIPES} fill="#ffffff" />
            <rect width={CANTON_WIDTH} height={CANTON_HEIGHT} fill="#3c3b6e" />
            <path d={STARS} fill="#ffffff" />
        </svg>
    );
}
