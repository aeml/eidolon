import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Paired lanceolate leaves follow sixteen curved, hanging shoots. Reuse the
// existing 256-leaf/1024-triangle crown budget; no transparent leaf cards,
// separate twig draws, animation updates or changes to tree placement.
export function createWillowCurtainGeometry(quality = 'high') {
    const positions = [], colors = [], uvs = [];
    const bladeUV = [[.5, 1], [1, .65], [.875, .275], [.5, 0], [.125, .275], [0, .65]];
    const up = new Vector3(0, 1, 0);
    for (let shoot = 0; shoot < 16; shoot++) {
        const angle = shoot * 2.399963229728653;
        const radial = new Vector3(Math.cos(angle), 0, Math.sin(angle));
        const tangent = new Vector3(-radial.z, 0, radial.x);
        const radius = .22 + (shoot % 5) * .105;
        const length = 1.48 + (shoot % 7) * .045;
        for (let leaf = 0; leaf < 16; leaf++) {
            const t = leaf / 15, sign = leaf % 2 ? 1 : -1;
            // The outward shoulder turns down as each shoot loses rigidity.
            // Correlated curvature avoids a straight row of disconnected fans.
            const center = radial.clone().multiplyScalar(radius + .15 * Math.sin(t * Math.PI * .8))
                .addScaledVector(tangent, .07 * Math.sin(t * 2.7 + shoot));
            center.y = .82 - t * length + .05 * Math.sin(shoot * 1.7);
            const forward = up.clone().multiplyScalar(-1).addScaledVector(radial, .18)
                .addScaledVector(tangent, sign * .35).normalize();
            const side = new Vector3().crossVectors(forward, radial).normalize();
            const normal = new Vector3().crossVectors(side, forward).normalize();
            const halfLength = .13 + ((shoot + leaf) % 5) * .008;
            const halfWidth = .040 + ((shoot * 3 + leaf) % 4) * .004;
            const point = (along, across) => center.clone().addScaledVector(forward, along * halfLength)
                .addScaledVector(side, across * halfWidth);
            // The long tip and narrow shoulder read as willow, not birch blades.
            const points = [point(1, 0), point(.35, 1), point(-.35, .75),
                point(-1, 0), point(-.35, -.75), point(.35, -1)];
            points[0].addScaledVector(normal, -.026);
            points[3].addScaledVector(normal, .009);
            const shade = .74 + (1 - t) * .18 + ((shoot + leaf) % 3) * .045;
            const faces = quality === 'low' ? [[0, 1, 3], [0, 3, 5]]
                : [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5]];
            for (const face of faces) for (const index of face) {
                const p = points[index]; positions.push(p.x, p.y, p.z);
                colors.push(shade * .92, shade, shade * .84);
                uvs.push(...bladeUV[index]);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.userData.woodlandCrown = 'willow';
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
