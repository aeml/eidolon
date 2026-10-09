import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bonded basalt blocks inside the old rectangular support. The visible joints
// and worn arrises belong to the geometry, not a second projected brick grid.
export function createKilnPier(height = 8, width = 3, seed = 0, quality = 'high') {
    const parts = [], rows = Math.ceil(height / 1.4), course = height / rows;
    const base = new THREE.Color(0x584841);
    for (let row = 0; row < rows; row++) {
        const split = (row % 2 ? -.17 : .17) * width;
        for (const [column, [left, right]] of [[-width / 2 + .045, split - .035],
            [split + .035, width / 2 - .045]].entries()) {
            const chip = .025 + (.5 + .5 * Math.sin(row * 7.3 + column * 2.1 + seed)) * .04;
            const shape = new THREE.Shape();
            shape.moveTo(left + chip, .04); shape.lineTo(right - chip, .04);
            shape.lineTo(right, .04 + chip); shape.lineTo(right, course - .04 - chip);
            shape.lineTo(right - chip, course - .04); shape.lineTo(left + chip, course - .04);
            shape.lineTo(left, course - .04 - chip); shape.lineTo(left, .04 + chip); shape.closePath();
            const block = new THREE.ExtrudeGeometry(shape, { depth: width - .12, steps: 1,
                bevelEnabled: quality !== 'low', bevelSize: .02, bevelThickness: .02,
                bevelSegments: 1, curveSegments: 1 });
            block.translate(0, row * course, -width / 2 + .06);
            const positions = block.attributes.position, colors = [];
            const tone = .92 + Math.sin(row * 4.7 + column * 8.3 + seed) * .08;
            for (let i = 0; i < positions.count; i++) {
                const soot = 1 - .17 * Math.max(0, 1 - positions.getY(i) / 2);
                colors.push(base.r * tone * soot, base.g * tone * soot, base.b * tone * soot);
            }
            block.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            parts.push(block);
        }
    }
    const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

// Flat forged webs and edge flanges distinguish the kiln frame from Water's
// carved stone ribs. The low crown fits the normal camera and stays overhead.
export function createKilnArchBeam(flange = false) {
    const outer = flange ? 10.6 : 10.42, inner = flange ? 9.4 : 9.58;
    const depth = flange ? .12 : 1, shape = new THREE.Shape();
    shape.moveTo(outer, 0); shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.lineTo(-inner, 0); shape.absarc(0, 0, inner, Math.PI, 0, true); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
        bevelSize: .035, bevelThickness: .035, bevelSegments: 1, steps: 1, curveSegments: 18 });
    geometry.scale(1, .55, 1); geometry.translate(0, 7, -depth / 2);
    geometry.computeBoundingBox();
    return geometry;
}
