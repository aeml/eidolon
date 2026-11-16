import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A pointed shell/rib profile in the Water entrance's compressed architecture
// space. Individual carved stones frame an actual opening, not a solid brow.
export function createTideReliquaryArch() {
    const stones = [];
    for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI + .005, b = (i + 1) / 14 * Math.PI - .005;
        const point = (angle, outer) => [Math.cos(angle) * (outer ? 8.1 : 5.9),
            8 + Math.pow(1 - Math.abs(Math.cos(angle)), .66) * (outer ? 12.5 : 10)];
        const shape = new THREE.Shape([point(a, false), point(a, true), point(b, true), point(b, false)]
            .map(([x, y]) => new THREE.Vector2(x, y)));
        const stone = new THREE.ExtrudeGeometry(shape, { depth: 2.15, bevelEnabled: true,
            bevelSize: .07, bevelThickness: .07, bevelSegments: 1, steps: 1 });
        stone.translate(0, 0, 20.5); stones.push(stone);
    }
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
        const stone = new THREE.BoxGeometry(2.12, 1.55, 2.2).toNonIndexed();
        stone.translate(side * 7, 1.6 + row * 1.75, 21.55); stones.push(stone);
    }
    const geometry = mergeGeometries(stones, false); stones.forEach(g => g.dispose());
    return geometry;
}
