import type { SVGAttributes } from "react";

/**
 * The Kaleb's Shop mark: two double-ended open spanners crossed in an X, as
 * in the shop's intro video. Each spanner is one outline with its handle slot
 * cut out under the evenodd rule, so the icon inherits `fill-current`.
 */
const SPANNER =
    "M6.2 -20.29A15.5 15.5 0 0 0 9.67 -46.62L6.38 -34.34A6.2 6.2 0 0 1 -5.6 -37.55L-2.31 -49.83A15.5 15.5 0 0 0 -6.2 -20.29L-6.2 20.29A15.5 15.5 0 0 0 -9.67 46.62L-6.38 34.34A6.2 6.2 0 0 1 5.6 37.55L2.31 49.83A15.5 15.5 0 0 0 6.2 20.29ZM-2.23 -15.77A2.23 2.23 0 0 1 2.23 -15.77L2.23 15.77A2.23 2.23 0 0 1 -2.23 15.77Z";

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path transform="translate(50 50) rotate(-45) scale(0.9)" fillRule="evenodd" d={SPANNER} />
            <path transform="translate(50 50) rotate(45) scale(0.9)" fillRule="evenodd" d={SPANNER} />
        </svg>
    );
}
