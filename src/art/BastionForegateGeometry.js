import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Parent architecture compresses Y by half. Work in that established space
// and keep every stone inside the legacy entrance envelope. Bevels and actual
// mortar gaps catch the sun at gameplay zoom without another texture atlas.
export function createBastionForegateGeometry() {
    const stones = [];
    const extrude = (points, depth, z) => {
        const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
        const stone = new THREE.ExtrudeGeometry(shape, { depth, steps: 1,
            bevelEnabled: true, bevelThickness: .09, bevelSize: .09,
            bevelSegments: 1, curveSegments: 1 });
        stone.translate(0, 0, z);
        stones.push(stone);
    };
    const count = 13;
    for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI + .006;
        const b = (i + 1) / count * Math.PI - .006;
        const keystone = i === 6;
        const outerY = keystone ? 12.2 : 11.5;
        const points = [
            [Math.cos(a) * 6.5, 12 + Math.sin(a) * 9.6],
            [Math.cos(a) * 8.9, 12 + Math.sin(a) * outerY],
            [Math.cos(b) * 8.9, 12 + Math.sin(b) * outerY],
            [Math.cos(b) * 6.5, 12 + Math.sin(b) * 9.6]
        ];
        extrude(points, keystone ? 3.05 : 2.8, 29.6);
    }
    for (const side of [-1, 1]) {
        for (let row = 0; row < 6; row++) {
            const y = 1.3 + row * 1.78;
            const x = side * 7.7;
            const chip = .10 + ((row * 7 + (side + 1)) % 3) * .045;
            extrude([[x - 1.08 + chip, y], [x + 1.08, y + chip],
                [x + 1.08 - chip, y + 1.59], [x - 1.08, y + 1.59 - chip]],
            2.7 + (row % 2) * .12, 29.6);
        }
        const x = side * 7.7;
        extrude([[x - 1.55, .95], [x + 1.55, .95], [x + 1.4, 1.45], [x - 1.4, 1.45]], 3.3, 29.35);
    }
    const result = mergeGeometries(stones, false);
    stones.forEach(stone => stone.dispose());
    return result;
}
