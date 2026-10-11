import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';

// A low, partially buried root network. Branches and broad bark tones remain
// readable from the ordinary isometric camera without textures or extra draws.
export function createDungeonGraveRootGeometry() {
    const paths = [
        { radius: .14, points: [[-1, -.05, 0], [-.72, .14, -.22], [-.35, .11, -.03], [0, .18, .22], [.4, .05, .05], [.7, 0, .29], [1, -.04, .38]] },
        { radius: .07, points: [[-.3, .12, .01], [-.15, .1, -.25], [.15, .02, -.5], [.5, -.03, -.6]] },
        { radius: .055, points: [[.15, .12, .2], [.28, .08, .42], [.55, .02, .56], [.9, -.04, .66]] }
    ];
    const parts = paths.map(({ points, radius }, branch) => {
        const geometry = createTaperedRoot(points, radius, 'low');
        const position = geometry.attributes.position, normal = geometry.attributes.normal;
        const colors = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
            // Slow longitudinal variation and a damp underside, rather than
            // high-frequency speckling that flickers on a small screen.
            const grain = .86 + .08 * Math.sin(position.getX(i) * 7 + branch);
            const damp = .7 + .3 * Math.max(0, normal.getY(i));
            colors[i * 3] = grain * damp;
            colors[i * 3 + 1] = grain * damp * .95;
            colors[i * 3 + 2] = grain * damp * .86;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geometry;
    });
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.dungeonGraveRoot = { branches: paths.length, visualOnly: true };
    return geometry;
}
