import * as THREE from 'three';

const random = seed => {
    let value = Math.imul(seed ^ 0x45d9f3b, 0x45d9f3b);
    value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
    return ((value ^ value >>> 16) >>> 0) / 4294967296;
};

// Low, partly buried slabs with irregular breaks, not a second raised floor.
// Vertex weathering softens the perimeter into the soil; all faces stay planar
// so these walkable decorations do not pretend to be navigation obstacles.
export function createBastionPavingFragment(seed) {
    const width = .68 + random(seed) * .29;
    const depth = .55 + random(seed + 2) * .28;
    const corners = [[-1, -.65], [-.65, -1], [.7, -1], [1, -.6],
        [1, .55], [.55, 1], [-.6, 1], [-1, .6]];
    const outline = corners.map(([x, z], i) => [
        x * width * (.73 + random(seed + i * 13) * .27),
        z * depth * (.74 + random(seed + i * 29) * .26)
    ]);
    const positions = [], colors = [], uv = [];
    // Linear multipliers: the shared fieldstone already supplies the stone
    // albedo. Multiplying by a second sRGB albedo made these read as holes.
    const center = new THREE.Color().setRGB(.70, .68, .61).multiplyScalar(.65 + random(seed + 3) * .2);
    const soil = new THREE.Color().setRGB(.43, .37, .30);
    for (let i = 0; i < outline.length; i++) {
        for (const [index, [x, z]] of [[0, 0], outline[(i + 1) % outline.length], outline[i]].entries()) {
            positions.push(x, 0, z);
            const tone = center.clone().lerp(soil, index ? .22 + random(seed + i * 7) * .4 : .05);
            colors.push(tone.r, tone.g, tone.b);
            uv.push(x / (width * 2) + .5, z / (depth * 2) + .5);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
}

export function createBastionMarkerCap(seed) {
    const chip = .13 + random(seed) * .13;
    const points = [[-.83 + chip, -.83], [.67, -.83], [.83, -.61], [.83, .58],
        [.58, .83], [-.68, .83], [-.83, .56], [-.83, -.53]];
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .3, steps: 1,
        bevelEnabled: true, bevelThickness: .09, bevelSize: .07, bevelSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    const normal = geometry.attributes.normal, colors = [];
    for (let i = 0; i < normal.count; i++) {
        const tone = normal.getY(i) > .5 ? new THREE.Color().setRGB(.86, .84, .76)
            : new THREE.Color().setRGB(.65, .64, .60);
        colors.push(tone.r, tone.g, tone.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}
