import * as THREE from 'three';

/**
 * A deliberately monochrome, physically based material set. Nothing here is
 * painted a colour: bodies are graphite with a clear coat, castings are
 * steel and iron, glass is tinted, rubber is rubber. Realism comes from the
 * environment reflections and shadows rather than from hue.
 */
export type Materials = {
    paint: THREE.MeshPhysicalMaterial;
    paintDark: THREE.MeshPhysicalMaterial;
    glass: THREE.MeshPhysicalMaterial;
    lens: THREE.MeshPhysicalMaterial;
    tailLens: THREE.MeshPhysicalMaterial;
    chrome: THREE.MeshStandardMaterial;
    steel: THREE.MeshStandardMaterial;
    alloy: THREE.MeshStandardMaterial;
    barrel: THREE.MeshStandardMaterial;
    iron: THREE.MeshStandardMaterial;
    heat: THREE.MeshStandardMaterial;
    plastic: THREE.MeshStandardMaterial;
    rubber: THREE.MeshStandardMaterial;
    fabric: THREE.MeshStandardMaterial;
    plate: THREE.MeshStandardMaterial;
    disc: THREE.MeshStandardMaterial;
    hotspot: THREE.MeshBasicMaterial;
};

export function makeMaterials(): Materials {
    return {
        paint: new THREE.MeshPhysicalMaterial({
            color: 0x35383d,
            metalness: 0.55,
            roughness: 0.32,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
        }),
        paintDark: new THREE.MeshPhysicalMaterial({
            color: 0x202226,
            metalness: 0.3,
            roughness: 0.55,
            clearcoat: 0.4,
            clearcoatRoughness: 0.3,
        }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x0d1115,
            metalness: 0.2,
            roughness: 0.04,
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            transparent: true,
            opacity: 0.72,
        }),
        lens: new THREE.MeshPhysicalMaterial({
            color: 0xdfe5ea,
            metalness: 0.1,
            roughness: 0.08,
            clearcoat: 1,
            transparent: true,
            opacity: 0.75,
        }),
        tailLens: new THREE.MeshPhysicalMaterial({
            color: 0x2a2a2c,
            metalness: 0.2,
            roughness: 0.1,
            clearcoat: 1,
            transparent: true,
            opacity: 0.85,
        }),
        chrome: new THREE.MeshStandardMaterial({
            color: 0xd8dadd,
            metalness: 1,
            roughness: 0.14,
        }),
        steel: new THREE.MeshStandardMaterial({
            color: 0x9a9ea3,
            metalness: 0.85,
            roughness: 0.42,
        }),
        alloy: new THREE.MeshStandardMaterial({
            color: 0xbfc3c8,
            metalness: 0.9,
            roughness: 0.3,
        }),
        barrel: new THREE.MeshStandardMaterial({
            color: 0x2c2e31,
            metalness: 0.6,
            roughness: 0.7,
            side: THREE.DoubleSide,
        }),
        iron: new THREE.MeshStandardMaterial({
            color: 0x4d5054,
            metalness: 0.6,
            roughness: 0.72,
        }),
        heat: new THREE.MeshStandardMaterial({
            color: 0x6e6a64,
            metalness: 0.7,
            roughness: 0.55,
        }),
        plastic: new THREE.MeshStandardMaterial({
            color: 0x17181a,
            metalness: 0.05,
            roughness: 0.82,
        }),
        rubber: new THREE.MeshStandardMaterial({
            color: 0x111213,
            metalness: 0,
            roughness: 0.96,
        }),
        fabric: new THREE.MeshStandardMaterial({
            color: 0x25272a,
            metalness: 0,
            roughness: 1,
        }),
        plate: new THREE.MeshStandardMaterial({
            color: 0xcfd2d5,
            metalness: 0.2,
            roughness: 0.5,
        }),
        disc: new THREE.MeshStandardMaterial({
            color: 0x8b8e92,
            metalness: 0.9,
            roughness: 0.35,
        }),
        hotspot: new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.9,
        }),
    };
}

/**
 * The materials a body is allowed to be made of. Engine parts clone their
 * materials, so fading these fades the body and nothing else.
 */
export function bodyMaterials(m: Materials): THREE.Material[] {
    return [
        m.paint,
        m.paintDark,
        m.glass,
        m.lens,
        m.tailLens,
        m.chrome,
        m.steel,
        m.alloy,
        m.barrel,
        m.iron,
        m.heat,
        m.plastic,
        m.rubber,
        m.fabric,
        m.plate,
        m.disc,
    ];
}
