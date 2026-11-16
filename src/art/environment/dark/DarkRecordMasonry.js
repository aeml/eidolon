import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The three historical Chronicle walls remain the collision authority. Dress
// their existing envelopes with bonded, bevelled stone instead of enlarging
// the building or closing its road-facing entrance. One site-owned submission.
export function createDarkRecordMasonry() {
    const parts = [];
    const add = (geometry, position, tone = 1, yaw = 0) => {
        const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose();
        part.rotateY(yaw); part.translate(...position);
        const colors = new Float32Array(part.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) colors.set([tone, tone, tone], i);
        part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(part);
    };
    const block = (width, height, depth, position, tone, yaw = 0) => {
        const bevel = Math.min(.025, height / 4, depth / 4, width / 4);
        const shape = new THREE.Shape();
        shape.moveTo(-width / 2 + bevel, -height / 2 + bevel);
        shape.lineTo(width / 2 - bevel, -height / 2 + bevel);
        shape.lineTo(width / 2 - bevel, height / 2 - bevel);
        shape.lineTo(-width / 2 + bevel, height / 2 - bevel);
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2,
            bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
            bevelSegments: 1, steps: 1, curveSegments: 1 });
        geometry.translate(0, 0, -depth / 2 + bevel);
        add(geometry, position, tone, yaw);
    };
    // Shallow fitted paving stays below ordinary Y.05 party markers. Recessed
    // mortar supports all slabs; gaps never reveal the underlying world void.
    add(new THREE.BoxGeometry(7.2, .01, 6.2), [0, .004, -.5], .66);
    for (let row = 0; row < 5; row++) for (let column = 0; column < 6; column++) {
        block(1.18, .024, 1.22, [-3 + column * 1.2, .017, -2.98 + row * 1.24],
            .87 + ((row * 7 + column * 3) % 9) * .023);
    }
    for (const [length, height, x, z, yaw] of [
        [7, 2.2, 0, -3.3, 0], [4.8, 1.5, -3.3, -.7, Math.PI / 2],
        [3.6, .85, 3.3, -1.3, Math.PI / 2]
    ]) {
        // A continuous inset core gives recessed joints actual dark depth.
        add(new THREE.BoxGeometry(length, height, .35), [x, height / 2, z], .61, yaw);
        const courses = Math.ceil(height / .36), pitchY = height / courses;
        for (let row = 0; row < courses; row++) {
            const offset = row % 2 ? -.55 : 0;
            for (let start = -length / 2 + offset; start < length / 2; start += 1.1) {
                const left = Math.max(-length / 2, start), right = Math.min(length / 2, start + 1.1);
                if (right - left < .08) continue;
                const along = (left + right) / 2;
                block(right - left - .022, pitchY - .018, .45,
                    [x + Math.cos(yaw) * along, (row + .5) * pitchY, z - Math.sin(yaw) * along],
                    .86 + ((row * 5 + Math.round((start + length) * 10)) % 11) * .022, yaw);
            }
        }
    }
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.name = 'Dark record bonded masonry';
    return geometry;
}
