import * as THREE from 'three';
import { createRealmGroundGeometry } from './RealmGroundGeometry.js';

// Partition the canonical surface, never resample it. Copying the original
// normals/UVs keeps tile edges identical to the unsplit terrain and its physics.
export function createRealmGroundMesh(region, material, elevation = null) {
    const source = createRealmGroundGeometry(region, .75, elevation);
    if (!elevation) return new THREE.Mesh(source, material);
    const root = new THREE.Group();
    root.userData.tiledRealmGround = true;
    const position = source.attributes.position, index = source.index;
    const buckets = new Map(), tileSize = 128;
    for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
        const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
        const key = `${Math.floor(x / tileSize)}:${Math.floor(y / tileSize)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(a, b, c);
    }
    for (const [key, vertices] of buckets) {
        const geometry = new THREE.BufferGeometry(), remap = new Map(), indices = [];
        for (const vertex of vertices) {
            if (!remap.has(vertex)) remap.set(vertex, remap.size);
            indices.push(remap.get(vertex));
        }
        for (const [name, attribute] of Object.entries(source.attributes)) {
            const array = new attribute.array.constructor(remap.size * attribute.itemSize);
            for (const [from, to] of remap) for (let component = 0; component < attribute.itemSize; component++) {
                array[to * attribute.itemSize + component] = attribute.array[from * attribute.itemSize + component];
            }
            geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
        }
        geometry.setIndex(indices);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const tile = new THREE.Mesh(geometry, material);
        tile.name = `terrain-tile:${key}`;
        tile.receiveShadow = true;
        root.add(tile);
    }
    source.dispose();
    return root;
}
