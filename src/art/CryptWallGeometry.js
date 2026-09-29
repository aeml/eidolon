import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One merged wall, entirely inside the original solid wall envelope. Blind
// funerary arches are recesses, not doors or additions to the walkable floor.
export function createCryptWallGeometry(width, height, depth) {
    if (width < 5 || height < 6) return new THREE.BoxGeometry(width, height, depth);
    const parts = [];
    const addBox = (w, h, d, x, y, z) => {
        const shape = new THREE.BoxGeometry(w, h, d).toNonIndexed();
        shape.translate(x, y - height / 2, z); parts.push(shape);
    };
    addBox(width, height, depth * .62, 0, height / 2, 0);
    addBox(width, .65, depth, 0, .325, 0);
    addBox(width, .55, depth, 0, height - .275, 0);
    addBox(width, .22, depth * .88, 0, height - 1.05, 0);
    const bays = Math.max(1, Math.min(12, Math.floor(width / 8)));
    const span = width / bays, pierWidth = Math.min(.95, span * .15);
    for (let i = 0; i <= bays; i++) {
        const x = THREE.MathUtils.clamp(-width / 2 + i * span,
            -width / 2 + pierWidth / 2, width / 2 - pierWidth / 2);
        addBox(pierWidth, height - .65, depth * .96, x, height / 2, 0);
    }
    for (let bay = 0; bay < bays; bay++) {
        const x = -width / 2 + (bay + .5) * span;
        const radius = Math.min(1.85, span * .28), spring = height * .48;
        const base = 1.5, thickness = depth * .14;
        for (const side of [-1, 1]) {
            const z = side * depth * .38;
            for (const hand of [-1, 1]) addBox(.3, spring - base, thickness,
                x + hand * (radius - .15), (spring + base) / 2, z);
            addBox(radius * 2, .24, thickness, x, base, z);
            for (let stone = 0; stone < 8; stone++) {
                const a = stone * Math.PI / 8 + .018, b = (stone + 1) * Math.PI / 8 - .018;
                const inner = radius - .3;
                const shape = new THREE.Shape([
                    [Math.cos(a) * radius, Math.sin(a) * radius],
                    [Math.cos(b) * radius, Math.sin(b) * radius],
                    [Math.cos(b) * inner, Math.sin(b) * inner],
                    [Math.cos(a) * inner, Math.sin(a) * inner]
                ].map(([px, py]) => new THREE.Vector2(px, py)));
                const arch = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1 });
                arch.translate(x, spring - height / 2, z - thickness / 2);
                parts.push(arch);
            }
        }
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    // Keep masonry in physical scale across piers, courses and arch blocks.
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        const along = ax > Math.max(ay, az) ? p.getZ(i) : p.getX(i);
        const across = ay > Math.max(ax, az) ? p.getZ(i) : p.getY(i);
        uv.setXY(i, along / width + .5, across / height + .5);
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.cryptWall = true;
    return geometry;
}
