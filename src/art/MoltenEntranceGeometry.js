import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function merge(parts) {
    const unpacked = parts.map(p => p.index ? p.toNonIndexed() : p);
    const geometry = mergeGeometries(unpacked, false);
    new Set([...parts, ...unpacked]).forEach(p => p.dispose());
    return geometry;
}

function archStone(innerX, innerY, outerX, outerY, spring, a, b, depth, z) {
    const shape = new THREE.Shape([
        [Math.cos(a) * innerX, spring + Math.sin(a) * innerY],
        [Math.cos(a) * outerX, spring + Math.sin(a) * outerY],
        [Math.cos(b) * outerX, spring + Math.sin(b) * outerY],
        [Math.cos(b) * innerX, spring + Math.sin(b) * innerY]
    ].map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
        bevelSize: .12, bevelThickness: .12, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, z); return geometry;
}

// These shapes use the entrance's compressed architecture space. They never
// redefine its legacy gameplay box or introduce a traversable interior.
export function createMoltenFoundation() {
    const outline = [[-34, -31], [-25, -33], [17, -32], [34, -26], [35, -8],
        [33, 17], [27, 28], [13, 29], [10, 35], [-10, 35], [-14, 28], [-31, 26], [-35, 8]];
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true,
        bevelSize: .35, bevelThickness: .2, bevelSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, .2, 0);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, Math.max(0, positions.getY(i)));
    return geometry;
}

export function createMoltenVault() {
    const parts = [];
    // Individual barrel-vault courses. The open front reveals the dark inner
    // chamber; neither a flat roof slab nor a doorway painted onto a solid box.
    for (let row = 0; row < 7; row++) for (let stone = 0; stone < 15; stone++) {
        parts.push(archStone(19.5, 15, 23, 18, 12,
            stone / 15 * Math.PI + .006, (stone + 1) / 15 * Math.PI - .006, 4.1, -21 + row * 4.4));
    }
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let along = 0; along < 7; along++) {
        const block = new THREE.BoxGeometry(3.6, 2.05, 4.1);
        block.translate(side * 21.1, 1.7 + row * 2.16, -18.8 + along * 4.4); parts.push(block);
    }
    const back = new THREE.BoxGeometry(39, 12, 2.2); back.translate(0, 7, -20); parts.push(back);
    const floor = new THREE.BoxGeometry(42, .7, 31); floor.translate(0, .8, -6); parts.push(floor);
    return merge(parts);
}

export function createMoltenVaultRib() {
    const parts = [];
    for (let stone = 0; stone < 15; stone++) parts.push(archStone(22.9, 17.9, 23.7, 18.8, 12,
        stone / 15 * Math.PI, (stone + 1) / 15 * Math.PI, .5, -.25));
    return merge(parts);
}

export function createMoltenForegate() {
    const parts = [];
    for (let stone = 0; stone < 11; stone++) parts.push(archStone(6.5, 11.3, 9.6, 14, 11,
        stone / 11 * Math.PI + .007, (stone + 1) / 11 * Math.PI - .007, 2.7, 30));
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
        const block = new THREE.BoxGeometry(3, 1.86, 2.9);
        block.translate(side * 8.1, 1.8 + row * 2.02, 31.35); parts.push(block);
    }
    return merge(parts);
}

export function createMoltenChain(start, end) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a), parts = [], count = Math.ceil(direction.length() / 1.35);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    for (let i = 0; i <= count; i++) {
        const link = new THREE.TorusGeometry(.56, .14, 4, 10);
        link.scale(1, 1.48, 1);
        if (i % 2) link.rotateY(Math.PI / 2);
        link.applyQuaternion(rotation);
        const p = a.clone().lerp(b, i / count);
        link.translate(p.x, p.y, p.z); parts.push(link);
    }
    return merge(parts);
}
