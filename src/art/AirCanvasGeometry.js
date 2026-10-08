import * as THREE from 'three';

// Original static canvas: corners/edges stay fixed to the existing frame.
// Billow remains within the windbreak's unchanged0.7m collision thickness.
export function createAirWindbreakSail(quality = 'high', seed = 0) {
    const geometry = new THREE.PlaneGeometry(14, 3.5, quality === 'low' ? 12 : 24, quality === 'low' ? 4 : 8);
    const p = geometry.attributes.position, colors = [];
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), u = (x + 7) / 14, v = (y + 1.75) / 3.5;
        const pinned = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        const fold = Math.sin(u * Math.PI * 8 + seed * .7) * .035;
        p.setZ(i, pinned * (.21 + fold));
        p.setY(i, y - pinned * .14);
        const hem = Math.min(u, 1 - u, v, 1 - v) < .045 ? .09 : 0;
        const wear = Math.sin(u * 19 + v * 7 + seed) * Math.sin(v * 17 - u * 11) * .025;
        const damp = (1 - v) ** 3 * .08;
        const tone = .92 - hem - damp + wear;
        colors.push(tone, tone * .99, tone * .98);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.airWindbreakSail = true;
    return geometry;
}
