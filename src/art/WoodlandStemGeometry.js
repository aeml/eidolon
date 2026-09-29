import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ring-built, tapered timber with a restrained bend and fluted bark. Its root
// stays inside the original cylinder radius; fork growth is overhead only.
export function createWoodlandStemGeometry({ height, baseRadius, tipRadius, bend = .18, forks = 0, seed = 1 }) {
    const sides = 12, rings = 10, positions = [], uvs = [], indices = [];
    const center = t => new THREE.Vector3(bend * t * t * Math.sin(t * 2.1 + seed),
        (t - .5) * height, bend * .5 * t * t * Math.sin(t * 3.2 + seed * 2));
    for (let ring = 0; ring <= rings; ring++) {
        const t = ring / rings, origin = center(t), radius = baseRadius + (tipRadius - baseRadius) * Math.pow(t, .7);
        for (let side = 0; side <= sides; side++) {
            const angle = side / sides * Math.PI * 2;
            const flute = .93 + Math.sin(angle * 5 + t * .7 + seed) * .05;
            positions.push(origin.x + Math.cos(angle) * radius * flute, origin.y,
                origin.z + Math.sin(angle) * radius * flute);
            uvs.push(side / sides, t);
            if (ring && side < sides) {
                const a = (ring - 1) * (sides + 1) + side, b = a + sides + 1;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
    }
    const trunk = new THREE.BufferGeometry();
    trunk.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trunk.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trunk.setIndex(indices); trunk.computeVertexNormals();
    // Average the duplicated UV seam normals, avoiding a visible bark stripe.
    const normals = trunk.attributes.normal;
    for (let ring = 0; ring <= rings; ring++) {
        const a = ring * (sides + 1), b = a + sides;
        const n = new THREE.Vector3().fromBufferAttribute(normals, a)
            .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
        normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
    }
    const pieces = [trunk.toNonIndexed()]; trunk.dispose();
    for (let fork = 0; fork < forks; fork++) {
        const t = .6 + fork * .085, angle = fork * 2.4 + seed;
        const start = center(t), end = start.clone().add(new THREE.Vector3(
            Math.cos(angle) * .85, height * .22, Math.sin(angle) * .85));
        const branch = new THREE.CylinderGeometry(.025, baseRadius * .32, start.distanceTo(end), 7, 3);
        branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()));
        branch.translate(...start.clone().add(end).multiplyScalar(.5).toArray());
        pieces.push(branch.toNonIndexed()); branch.dispose();
    }
    const geometry = mergeGeometries(pieces, false); pieces.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
