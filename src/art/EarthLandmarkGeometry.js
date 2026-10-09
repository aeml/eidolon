import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const stoneNoise = seed => ((Math.imul(seed + 17, 73856093) ^ Math.imul(seed + 91, 19349663)) >>> 0) / 4294967296;

// Block-to-block limestone tones and damp lower courses, not another painted
// brick grid. The material's world-space grain supplies the finer detail.
function weatherStone(geometry, seed) {
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    const values = [], tone = .78 + stoneNoise(seed) * .32;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const damp = Math.max(0, 1 - y / 2.6) * (.55 + .2 * Math.sin(x * 2 + z));
        const lichen = Math.max(0, normal.getY(i)) * (.5 + .5 * Math.sin(x * 1.7 + z * 2.3 + seed)) * .16;
        values.push(tone * (1 - damp * .4 - lichen), tone * (1 - damp * .22 - lichen * .35),
            tone * (1 - damp * .5 - lichen));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(values, 3));
    return geometry;
}

// Site-owned geometry; no global caches, textures, collider or gameplay changes.
export function createTaperedRoot(points, radius, quality = 'high') {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const segments = quality === 'low' ? 12 : 24, radial = quality === 'low' ? 6 : 10;
    const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
    const position = geometry.attributes.position, center = new THREE.Vector3(), vertex = new THREE.Vector3();
    for (let ring = 0; ring <= segments; ring++) {
        const t = ring / segments;
        curve.getPointAt(t, center);
        const taper = .035 + .965 * Math.pow(1 - t, .8);
        for (let side = 0; side <= radial; side++) {
            const index = ring * (radial + 1) + side;
            const rib = 1 + .055 * Math.sin(side / radial * Math.PI * 10 + t * 4) * Math.sin(t * Math.PI);
            vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(taper * rib).add(center);
            position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function createGroveArchStone(index, count = 13) {
    const a = index / count * Math.PI + .005, b = (index + 1) / count * Math.PI - .005;
    const inner = 6.5, outer = 9.5 + (index === Math.floor(count / 2) ? .24 : 0);
    const shape = new THREE.Shape();
    // Follow the actual segmental vault instead of joining thirteen flat
    // wedges into a polygon. Small inward wear varies each bonded block;
    // no detached rubble, extra material/draw batch or wider solid footprint.
    const edge = (angle, radius) => shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    shape.moveTo(Math.cos(a) * (inner + .035), Math.sin(a) * (inner + .035));
    edge(a, outer - .04 - stoneNoise(index + 41) * .08);
    edge((a + b) / 2, outer - .01 - stoneNoise(index + 67) * .025);
    edge(b, outer - .04 - stoneNoise(index + 121) * .08);
    edge(b, inner + .035);
    edge((a + b) / 2, inner + .012 + stoneNoise(index + 151) * .018);
    shape.closePath();
    const body = new THREE.ExtrudeGeometry(shape, { depth: 3.72, steps: 1,
        bevelEnabled: true, bevelThickness: .10, bevelSize: .075, bevelSegments: 1, curveSegments: 1 });
    // A low carved lip catches light along both faces of the opening. Build
    // it into this stone's existing batch, within its old depth envelope.
    const values = [], uv = [], angles = [a, (a + b) / 2, b];
    const triangle = (p, q, r) => {
        for (const point of [p, q, r]) { values.push(...point); uv.push(point[0], point[1]); }
    };
    for (const back of [false, true]) {
        const base = back ? 3.73 : -.01, crest = back ? 3.80 : -.08;
        const rings = angles.map(angle => [[6.61, base], [6.75, crest], [6.92, base]]
            .map(([radius, z]) => [Math.cos(angle) * radius, Math.sin(angle) * radius, z]));
        for (let section = 0; section < 2; section++) for (let band = 0; band < 2; band++) {
            const [p, q, r, s] = [rings[section][band], rings[section][band + 1],
                rings[section + 1][band + 1], rings[section + 1][band]];
            if (back) { triangle(p, q, r); triangle(p, r, s); }
            else { triangle(p, r, q); triangle(p, s, r); }
        }
        const start = rings[0], end = rings[2];
        if (back) { triangle(start[0], start[2], start[1]); triangle(end[0], end[1], end[2]); }
        else { triangle(start[0], start[1], start[2]); triangle(end[0], end[2], end[1]); }
    }
    const lip = new THREE.BufferGeometry();
    lip.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    lip.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lip.computeVertexNormals();
    const geometry = mergeGeometries([body, lip], false);
    body.dispose(); lip.dispose();
    // A low segmental vault keeps the complete landmark readable at the actual
    // gameplay camera, rather than pushing its crown off the desktop view.
    geometry.scale(1, .55, 1);
    geometry.translate(0, 8, -1.86);
    return weatherStone(geometry, index + 39);
}

export function createGrovePierCourse(index) {
    const stones = [];
    // Staggered front/back joints make the pier actual bonded masonry instead
    // of six monolithic slices. Everything stays inside its existing collider.
    for (let row = 0; row < 2; row++) {
        const split = (index + row) % 2 ? -.43 : .43;
        for (const [column, [left, right]] of [[-1.42, split - .09], [split + .09, 1.42]].entries()) {
            const seed = index * 19 + row * 7 + column;
            const chip = .025 + stoneNoise(seed) * .035;
            const shape = new THREE.Shape();
            shape.moveTo(left + chip, 0); shape.lineTo(right, chip);
            // Unequal worn corners and a shallow loss at the exposed top edge
            // break up perfect horizontal slices without moving bonded joints.
            shape.lineTo(right - chip, 1.18 - chip);
            shape.lineTo(right - .18 - chip, 1.18);
            shape.lineTo(left + .12 + chip, 1.18 - stoneNoise(seed + 31) * .045);
            shape.lineTo(left, 1.18 - chip); shape.closePath();
            const stone = new THREE.ExtrudeGeometry(shape, { depth: 1.72, steps: 1,
                bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 1, curveSegments: 1 });
            stone.translate(0, index * (8 / 6) + .075, row ? .1 : -1.82);
            stones.push(weatherStone(stone, seed));
        }
    }
    const geometry = mergeGeometries(stones, false);
    stones.forEach(stone => stone.dispose());
    return geometry;
}

// Worn, almost-flush threshold fragments: decorative walking surface, not a
// raised obstacle. Low height avoids requiring an invented client-only step.
export function createGroveThresholdStone(seed) {
    const width = .7 + stoneNoise(seed) * .35, depth = .48 + stoneNoise(seed + 3) * .2;
    const chip = .12 + stoneNoise(seed + 9) * .2;
    const points = [[-width + chip, -depth], [width - .09, -depth + .05], [width, -depth + chip],
        [width - .035, depth - .1], [width - chip, depth], [-width + .07, depth - .03],
        [-width, depth - chip], [-width + .025, -depth + .13]].map(([x, y]) => new THREE.Vector2(x, y));
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
    geometry.rotateX(-Math.PI / 2);
    weatherStone(geometry, seed + 83);
    // Buried paving should sit quietly in the dirt, not read as bright leaves.
    const colors = geometry.attributes.color;
    for (let i = 0; i < colors.array.length; i++) colors.array[i] *= .58;
    return geometry;
}
