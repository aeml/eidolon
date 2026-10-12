import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Expedition lamps are ordinary supported metalwork around a restrained
// elemental core. All three batches fit the existing 2.2m x 6m walk solid.
export function createDarkCampLanternGeometry(quality = 'high') {
    const segments = quality === 'low' ? 8 : 16;
    const stone = [], metal = [], core = [];
    const lathe = (parts, profile, count = segments) => {
        const geometry = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), count);
        // LatheGeometry duplicates the axis at capped poles. Retain each cap
        // fan's real face, without zero-area triangles at its duplicate vertex.
        const p = geometry.attributes.position, index = geometry.index, faces = [];
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < index.count; i += 3) {
            a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
            if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-14) faces.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        }
        geometry.setIndex(faces); geometry.normalizeNormals();
        parts.push(geometry.toNonIndexed()); geometry.dispose();
    };
    const cylinder = (top, bottom, height, y, count = segments) => {
        const geometry = new THREE.CylinderGeometry(top, bottom, height, count).toNonIndexed();
        geometry.translate(0, y, 0); metal.push(geometry);
    };
    lathe(stone, [[0, .1], [1.06, .1], [1.06, .28], [.97, .38], [.83, .38], [.83, .94], [.73, 1.06], [0, 1.06]]);
    cylinder(.14, .22, 3.08, 2.6);
    cylinder(.29, .29, .12, 1.14);
    cylinder(.23, .23, .12, 3.97);
    // Bowl, overhanging rain cap and finial make a readable lantern silhouette.
    lathe(metal, [[0, 4.03], [.3, 4.03], [.66, 4.2], [.66, 4.3], [0, 4.3]], 8);
    lathe(metal, [[0, 5.34], [.76, 5.34], [.76, 5.43], [.2, 5.78], [0, 5.78]], 8);
    cylinder(.045, .11, .16, 5.84, 8);
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const bar = new THREE.BoxGeometry(.055, 1.1, .055).toNonIndexed();
        bar.rotateY(angle); bar.translate(Math.sin(angle) * .55, 4.82, Math.cos(angle) * .55); metal.push(bar);
    }
    lathe(core, [[0, 4.32], [.28, 4.32], [.37, 4.48], [.37, 5.15], [.25, 5.31], [0, 5.31]], 8);
    const merge = parts => {
        const geometry = mergeGeometries(parts, false);
        parts.forEach(part => part.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return geometry;
    };
    return { stone: merge(stone), metal: merge(metal), core: merge(core) };
}
