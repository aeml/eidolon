import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// A single opaque crown batch:64 clustered canopy leaves and64 lanceolate
// leaves on eight hanging shoots. Low retains every leaf's tip/shoulders/root;
// only its small six-point outline simplifies. No alpha cards or twig draws.
export function createDrownedWillowGeometry(quality = 'high') {
    const positions = [], colors = [], uvs = [], up = new Vector3(0, 1, 0);
    const bladeUV = [[.5, 1], [1, .65], [.875, .275], [.5, 0], [.125, .275], [0, .65]];
    const faces = quality === 'low' ? [[0, 1, 3], [0, 3, 5]]
        : [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5]];
    const leaf = (center, forward, side, normal, length, width, shade) => {
        const point = (along, across) => center.clone().addScaledVector(forward, along * length)
            .addScaledVector(side, across * width);
        const points = [point(1, 0), point(.35, 1), point(-.35, .75),
            point(-1, 0), point(-.35, -.75), point(.35, -1)];
        points[0].addScaledVector(normal, .025); points[3].addScaledVector(normal, .008);
        for (const face of faces) for (const index of face) {
            const p = points[index]; positions.push(p.x, p.y, p.z);
            colors.push(shade * .93, shade, shade * .96); uvs.push(...bladeUV[index]);
        }
    };
    const lobes = [[-.85, -.1, .15], [.85, -.05, .02], [-.2, .22, .75], [.35, .25, -.75]];
    for (let index = 0; index < 64; index++) {
        const angle = index * 2.399963229728653, y = 1 - 2 * (index + .5) / 64;
        const radial = Math.sqrt(1 - y * y), direction = new Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
        const lobe = lobes[index % lobes.length];
        const center = new Vector3(.8 + lobe[0], 5.35 + lobe[1], lobe[2]).addScaledVector(direction, .25 + index % 5 * .04);
        const normal = direction.clone().addScaledVector(up, .8).normalize();
        const side = new Vector3().crossVectors(normal, up).normalize();
        const forward = new Vector3().crossVectors(side, normal).normalize();
        side.applyAxisAngle(normal, index * .79); forward.applyAxisAngle(normal, index * .79);
        leaf(center, forward, side, normal, .34 + index % 5 * .027, .15 + index % 3 * .018, .8 + index % 4 * .045);
    }
    for (const sideSign of [-1, 1]) for (let shoot = 0; shoot < 4; shoot++) for (let index = 0; index < 8; index++) {
        const t = index / 7;
        const center = new Vector3(.8 + sideSign * (1.0 + shoot * .12 + .15 * Math.sin(t * Math.PI)),
            5.08 - t * (2.1 + shoot * .08), -.48 + shoot * .32 + .1 * Math.sin(t * 2.6 + shoot));
        const forward = new Vector3(sideSign * .18, -1, index % 2 ? .32 : -.32).normalize();
        const side = new Vector3().crossVectors(forward, new Vector3(sideSign, 0, 0)).normalize();
        const normal = new Vector3().crossVectors(side, forward).normalize();
        leaf(center, forward, side, normal, .19 + (shoot + index) % 4 * .016, .045 + index % 3 * .007,
            .75 + (1 - t) * .16 + shoot % 2 * .035);
    }
    const geometry = new BufferGeometry();
    geometry.userData.woodlandCrown = 'drowned-willow';
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
