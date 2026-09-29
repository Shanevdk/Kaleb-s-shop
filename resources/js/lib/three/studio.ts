import * as THREE from 'three';

/**
 * A photographic studio that is only ever seen in reflections.
 *
 * Paint, chrome and glass look real because of what they reflect, so this
 * is laid out the way a car studio is: a pale floor, dark walls, one huge
 * diffuser overhead with long light tubes either side of it, tall strip
 * boxes at the corners and a low kicker along one flank. The boundary
 * between the pale floor and the dark walls draws the horizon line that
 * runs down the side of every photographed car. Each light fades out at
 * its edges like real diffusion fabric, so highlights roll off instead of
 * ending in a hard rectangle.
 */
export class StudioEnvironment extends THREE.Scene {
    constructor() {
        super();

        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(40, 64, 32),
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                depthWrite: false,
                vertexShader: /* glsl */ `
                    varying vec3 vDirection;
                    void main() {
                        vDirection = normalize(position);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: /* glsl */ `
                    varying vec3 vDirection;
                    void main() {
                        float h = normalize(vDirection).y;
                        vec3 floorNear = vec3(0.30);
                        vec3 floorFar = vec3(0.19);
                        vec3 horizon = vec3(0.075);
                        vec3 wall = vec3(0.035);
                        vec3 ceiling = vec3(0.055);
                        vec3 colour;
                        if (h < 0.0) {
                            colour = mix(floorFar, floorNear, smoothstep(-0.05, -0.9, h));
                            colour = mix(horizon, colour, smoothstep(0.0, -0.06, h));
                        } else {
                            colour = mix(horizon, wall, smoothstep(0.0, 0.18, h));
                            colour = mix(colour, ceiling, smoothstep(0.45, 1.0, h));
                        }
                        gl_FragColor = vec4(colour, 1.0);
                    }
                `,
            }),
        );
        this.add(dome);

        const warm = new THREE.Color(1.0, 0.97, 0.93);
        const cool = new THREE.Color(0.93, 0.96, 1.0);
        const white = new THREE.Color(1, 1, 1);

        // The overhead diffuser and the two long tubes beside it.
        this.add(
            softbox(11, 5.5, 4.2, white, 0.3, [0, 9, 0], [-Math.PI / 2, 0, 0]),
        );
        for (const z of [-3.9, 3.9]) {
            this.add(
                softbox(
                    13,
                    0.7,
                    9,
                    cool,
                    0.2,
                    [0, 8.4, z],
                    [-Math.PI / 2, 0, 0],
                ),
            );
        }

        // Tall strip boxes at the four corners, turned in towards the car.
        for (const [x, z, intensity, tint] of [
            [7.5, 9.5, 6.5, warm],
            [-7.5, 9.5, 5.0, warm],
            [7.5, -9.5, 4.5, cool],
            [-7.5, -9.5, 5.5, cool],
        ] as [number, number, number, THREE.Color][]) {
            const strip = softbox(1.6, 7.5, intensity, tint, 0.18, [x, 4.2, z]);
            strip.lookAt(0, 1.2, 0);
            this.add(strip);
        }

        // Broad, gentle fills front and back, and a low kicker along the flank.
        const front = softbox(9, 4, 1.6, warm, 0.35, [15, 3.2, 0]);
        front.lookAt(0, 1, 0);
        this.add(front);
        const back = softbox(9, 4, 1.1, cool, 0.35, [-15, 3.2, 0]);
        back.lookAt(0, 1, 0);
        this.add(back);
        const kicker = softbox(16, 0.4, 3.5, white, 0.25, [0, 1.0, -12]);
        kicker.lookAt(0, 1.0, 0);
        this.add(kicker);
    }

    dispose(): void {
        this.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                (object.material as THREE.Material).dispose();
            }
        });
    }
}

/**
 * A rectangle of diffused light that is brightest in the middle and falls
 * away over the given fraction of its size at the edges.
 */
function softbox(
    width: number,
    height: number,
    intensity: number,
    tint: THREE.Color,
    softness: number,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
    // The fade is the same physical distance on every edge.
    const fade = softness * Math.min(width, height);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            depthWrite: false,
            uniforms: {
                colour: {
                    value: new THREE.Vector3(
                        tint.r,
                        tint.g,
                        tint.b,
                    ).multiplyScalar(intensity),
                },
                softness: {
                    value: new THREE.Vector2(
                        Math.min(0.5, fade / width),
                        Math.min(0.5, fade / height),
                    ),
                },
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 colour;
                uniform vec2 softness;
                varying vec2 vUv;
                void main() {
                    vec2 edge = min(vUv, 1.0 - vUv);
                    float fade = smoothstep(0.0, softness.x, edge.x) * smoothstep(0.0, softness.y, edge.y);
                    gl_FragColor = vec4(colour * fade, 1.0);
                }
            `,
        }),
    );
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);

    return mesh;
}
