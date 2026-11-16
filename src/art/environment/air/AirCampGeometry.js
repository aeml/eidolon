import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Padded, folded canvas and a tightly rolled head end, grounded within the
// original 2.6x4 metre bedroll. This is abandoned scenery, not an interaction
// or a new movement blocker. Both parts join the existing windbreak canvas
// batch, including its vertex-color format, rather than adding a cloth draw.
export function createAirBedroll(quality = 'high') {
    const low = quality === 'low';
    const quilt = new THREE.PlaneGeometry(2.5, 3.8, low ? 6 : 10, low ? 12 : 20);
    quilt.rotateX(-Math.PI / 2);
    const positions = quilt.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        const edge = Math.max(Math.abs(x) / 1.25, Math.abs(z) / 1.9);
        const padding = Math.max(0, 1 - edge * edge);
        const fold = Math.sin(x * 7 + z * 1.3) * .012 * padding;
        positions.setY(i, .05 + padding * .19 + fold);
        const hem = Math.max(0, Math.min(1, (edge - .84) / .16));
        const wear = .018 * Math.sin(z * 5.8 + x * .5);
        colors.set([.48 - hem * .11 + wear, .44 - hem * .1 + wear,
            .38 - hem * .085 + wear], i * 3);
    }
    quilt.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    quilt.computeVertexNormals();
    const roll = new THREE.CylinderGeometry(.17, .17, 2.35, low ? 6 : 12);
    roll.rotateZ(Math.PI / 2);
    roll.translate(0, .19, -1.65);
    const rollColors = new Float32Array(roll.attributes.position.count * 3);
    for (let i = 0; i < roll.attributes.position.count; i++) {
        const end = Math.abs(roll.attributes.position.getX(i)) > 1.16;
        rollColors.set(end ? [.34, .31, .27] : [.45, .41, .35], i * 3);
    }
    roll.setAttribute('color', new THREE.BufferAttribute(rollColors, 3));
    const pieces = [quilt.toNonIndexed(), roll.toNonIndexed()];
    const geometry = mergeGeometries(pieces, false);
    for (const piece of [quilt, roll, ...pieces]) piece.dispose();
    geometry.computeBoundingBox();
    return geometry;
}
