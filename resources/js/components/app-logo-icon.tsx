import type { SVGAttributes } from "react";

/**
 * Crossed open-end wrench and screwdriver, in the style of a vintage mechanic's
 * badge. Every subpath is wound so the shapes union (and the jaw/ring openings
 * knock out) under the default nonzero fill rule when the icon inherits
 * `fill-current`.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <g transform="rotate(-45 16 16)">
                <path d="M17.57 3.28A4.6 4.6 0 1 1 14.43 3.28L15.18 5.34A2.4 2.4 0 1 0 16.82 5.34Z M13.6 7.6L18.4 7.6L18.4 24.6L13.6 24.6Z M12 24.6A4 4 0 1 1 20 24.6A4 4 0 1 1 12 24.6Z M14.1 24.6A1.9 1.9 0 1 0 17.9 24.6A1.9 1.9 0 1 0 14.1 24.6Z" />
            </g>
            <g transform="rotate(45 16 16)">
                <path d="M12.2 5.4A2.4 2.4 0 0 1 14.6 3L17.4 3A2.4 2.4 0 0 1 19.8 5.4L19.8 14L12.2 14Z M14.6 14L17.4 14L17.4 24.2L14.6 24.2Z M14.2 24.2L17.8 24.2L18.4 27.2L18.4 29L13.6 29L13.6 27.2Z" />
            </g>
        </svg>
    );
}
