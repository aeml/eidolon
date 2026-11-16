import * as THREE from 'three';

// Two tensioned panels share a ridge. Curved profiles, hanging hems and shallow
// folds give the abandoned shelters weight without cloth physics, transparent
// layers, extra textures or an additional material batch.
export function createPilgrimCanopy(quality = 'high') {
    const across = quality === 'low' ? 4 : 6, along = quality === 'low' ? 6 : 8;
    const positions = [], colors = [], uvs = [], indices = [];
    for (const side of [-1, 1]) {
        const offset = positions.length / 3;
        for (let row = 0; row <= along; row++) for (let column = 0; column <= across; column++) {
            const u = column / across, v = row / along;
            const sag = .23 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
            const hem = .055 * u ** 4 * Math.sin(v * Math.PI * 6);
            positions.push(side * u * 2.5, 3.8 - u * 3.38 - sag + hem, (v - .5) * 5.2);
            uvs.push(u, v);
            // Broad pigment weathering remains visible at play distance;
            // directional illumination still comes from physical lighting.
            const weather = .92 + .06 * Math.sin(v * 5.7 + u * 2.1), edge = 1 - .14 * u ** 6;
            colors.push(weather * edge, weather * edge, weather * edge * (.94 + .04 * v));
            if (row < along && column < across) {
                const a = offset + row * (across + 1) + column, b = a + 1, c = a + across + 1, d = c + 1;
                indices.push(...(side < 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
