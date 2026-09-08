import * as THREE from 'three';
import { createProceduralTerrainTexture } from './ProceduralRealmTerrain.js';

// A low-walled sparring court. The server owns the floor dimensions and movement
// limits; markings are decorative inlays, never additional collision or loot.
export function createProceduralPvPArena(layout) {
    const rect = layout?.walkRects?.[0];
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
        rect.width <= 0 || rect.height <= 0) throw new Error('PvP arena requires its authoritative floor');
    const root = new THREE.Group();
    root.name = 'PvPArena';
    const paving = createProceduralTerrainTexture('town');
    paving.repeat.set(rect.width / 12, rect.height / 12);
    const stone = new THREE.MeshStandardMaterial({ map: paving, color: 0xb5c2d6, roughness: 0.9 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x66758a, roughness: 0.75 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc7ae72, roughness: 0.55, metalness: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(rect.width, rect.height), stone);
    floor.name = 'PvPArenaFloor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(rect.x || 0, 0.1, rect.z || 0);
    floor.receiveShadow = true;
    root.add(floor);
    const box = (width, height, depth, x, z, material = rim) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.set((rect.x || 0) + x, height / 2, (rect.z || 0) + z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
    };
    for (const sign of [-1, 1]) {
        box(rect.width + 1, 0.7, 0.5, 0, sign * (rect.height / 2 + 0.25));
        box(0.5, 0.7, rect.height, sign * (rect.width / 2 + 0.25), 0);
    }
    const ring = (x, z, radius, material) => {
        const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.08, radius, 64), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((rect.x || 0) + x, 0.115, (rect.z || 0) + z);
        root.add(mesh);
    };
    ring(0, 0, 6, gold); ring(0, 0, 6.5, gold);
    // Team circles and four elemental beacons orient players without tall
    // facades concealing targets. Every beacon sits outside the walking floor.
    const colors = [0x7cc895, 0x77cbea, 0xf6a468, 0xc5b3f1];
    colors.forEach((color, index) => {
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3 });
        const x = (index % 2 ? 1 : -1) * (rect.width / 2 + 0.8);
        const z = (index < 2 ? -1 : 1) * (rect.height / 2 + 0.8);
        box(1.6, 1, 1.6, x, z);
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), material);
        crystal.scale.y = 1.7;
        crystal.position.set((rect.x || 0) + x, 2.2, (rect.z || 0) + z);
        root.add(crystal);
        if (index < 2) ring(index ? 8 : -8, -3, 2, material);
    });
    return root;
}
