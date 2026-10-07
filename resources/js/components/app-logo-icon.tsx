import { useId } from 'react';
import type { SVGAttributes } from 'react';

/**
 * The Kaleb's Shop mark: an open spanner laid across a gear. The gear is cut
 * back around the spanner so the two read apart in one colour, and the
 * spanner's jaw and handle slot are cut out of it, so the icon inherits
 * `fill-current`. public/favicon.svg draws the same shapes.
 */
const GEAR =
    'M46.37 25.59L47.56 19.3L56.44 19.3L57.63 25.59L66.69 29.35L71.98 25.74L78.26 32.02L74.65 37.31L78.41 46.37L84.7 47.56L84.7 56.44L78.41 57.63L74.65 66.69L78.26 71.98L71.98 78.26L66.69 74.65L57.63 78.41L56.44 84.7L47.56 84.7L46.37 78.41L37.31 74.65L32.02 78.26L25.74 71.98L29.35 66.69L25.59 57.63L19.3 56.44L19.3 47.56L25.59 46.37L29.35 37.31L25.74 32.02L32.02 25.74L37.31 29.35ZM70.5 52A18.5 18.5 0 1 0 33.5 52A18.5 18.5 0 1 0 70.5 52Z';

/** The spanner is drawn along the x axis from the middle of its head. */
const SPANNER_PLACE = 'translate(20 29) rotate(35.4)';
const SPANNER_HANDLE = 'M0 -6.3H82A6.3 6.3 0 0 1 82 6.3H0Z';
const SPANNER_JAW = 'M1 -4.4L-20 -7V7L1 4.4L-1.5 0Z';
const SPANNER_SLOT =
    'M22 -1.9H78A1.9 1.9 0 0 1 78 1.9H22A1.9 1.9 0 0 1 22 -1.9Z';

function Spanner() {
    return (
        <>
            <circle r="14" />
            <path d={SPANNER_HANDLE} />
        </>
    );
}

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    // Every logo on a page needs its own mask ids.
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

    return (
        <svg
            {...props}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <mask
                    id={`${id}-gear`}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                >
                    <rect width="100" height="100" fill="#fff" />
                    <g
                        transform={SPANNER_PLACE}
                        fill="#000"
                        stroke="#000"
                        strokeWidth="5"
                    >
                        <Spanner />
                    </g>
                </mask>
                <mask
                    id={`${id}-spanner`}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                >
                    <rect width="100" height="100" fill="#fff" />
                    <g transform={SPANNER_PLACE} fill="#000">
                        <path transform="rotate(-35.4)" d={SPANNER_JAW} />
                        <path d={SPANNER_SLOT} />
                    </g>
                </mask>
            </defs>
            <path fillRule="evenodd" d={GEAR} mask={`url(#${id}-gear)`} />
            <g mask={`url(#${id}-spanner)`}>
                <g transform={SPANNER_PLACE}>
                    <Spanner />
                </g>
            </g>
        </svg>
    );
}
