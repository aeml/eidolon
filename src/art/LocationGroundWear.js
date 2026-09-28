import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Scene-owned ground dressing, never a second walk floor or a new interaction.
// Opacity feathers into the existing terrain; low chips stay below step height.
export function createLocationGroundMaterials(realm) {
    const palette = { water: [63, 82, 88], fire: [49, 39, 34], air: [68, 64, 73] }[realm];
    if (!palette) throw new TypeError(`Unknown ground-wear realm: ${realm}`);
    const size = 64, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5;
        const noise = ((Math.imul(x + 11, 73856093) ^ Math.imul(y + 23, 19349663)) >>> 0) % 101 / 100;
        const radius = Math.hypot(u, v), offset = (y * size + x) * 4;
        for (let c = 0; c < 3; c++) pixels[offset + c] = palette[c] * (.8 + .3 * noise);
        pixels[offset + 3] = Math.max(0, Math.min(1, (1 - radius - noise * .12) * 2)) * 155;
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.colorSpace = THREE.SRGBColorSpace; map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
    map.name = `${realm} weathered ground apron`;
    return {
        ground: new THREE.MeshStandardMaterial({ map, roughness: 1, transparent: true, depthWrite: false,
            alphaTest: .01, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        chips: new THREE.MeshStandardMaterial({ color: realm === 'water' ? 0x74848b : realm === 'fire' ? 0x4f4540 : 0x807b86,
            roughness: .95, vertexColors: true })
    };
}

export function addLocationGroundWear(group, site, materials, isClear, hazards = []) {
    const centerX = site.arrivalOffset?.[0] || 0, centerZ = site.arrivalOffset?.[1] || 0;
    const hazardClearance = Math.min(Infinity, ...hazards.map(([x, z, radius]) =>
        Math.hypot(site.x + centerX - x, site.z + centerZ - z) - radius - 2));
    // The whole rotated apron rectangle (not only its center) must clear
    // environmental warnings. Existing story sites can sit near such hazards.
    const radius = Math.max(0, Math.min(19, site.radius * .8, hazardClearance / 1.6));
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.4, radius * 2), materials.ground);
    apron.rotation.x = -Math.PI / 2; apron.rotation.z = .13;
    apron.position.set(centerX, .022, centerZ); apron.name = `${site.id}:ground-wear`;
    apron.receiveShadow = true; group.add(apron);
    let seed = 2166136261;
    for (const char of site.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const base = new THREE.DodecahedronGeometry(1), parts = [];
    for (let i = 0; i < 36; i++) {
        const angle = random() * Math.PI * 2, distance = radius * (.4 + .5 * random());
        const x = centerX + Math.cos(angle) * distance, z = centerZ + Math.sin(angle) * distance;
        const width = .25 + random() * .65, shade = .8 + random() * .35;
        if (site.role === 'story' && Math.hypot(x, z) < 10) continue;
        if (!isClear(site.x + x, site.z + z) || hazards.some(([hx, hz, r]) =>
            Math.hypot(site.x + x - hx, site.z + z - hz) < r + 2)) continue;
        const geometry = base.clone();
        geometry.scale(width, .07 + width * .1, width * .7);
        geometry.rotateY(angle); geometry.translate(x, .08, z);
        const colors = new Float32Array(geometry.attributes.position.count * 3); colors.fill(shade);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); parts.push(geometry);
    }
    base.dispose();
    if (parts.length) {
        const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
        const mesh = new THREE.Mesh(geometry, materials.chips);
        mesh.name = `${site.id}:ground-chips`; mesh.receiveShadow = true; group.add(mesh);
    }
}
