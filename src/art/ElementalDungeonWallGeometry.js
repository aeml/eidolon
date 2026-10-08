import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const profiles = Object.freeze({
    molten_core: { span: 12, pier: 1.3, band: .9, crown: .7, arch: 'forge' },
    tempest_spire: { span: 10, pier: .65, band: .45, crown: .4, arch: 'spire' },
    abyssal_well: { span: 11, pier: 1.05, band: .75, crown: .6, arch: 'tide' },
    umbral_nexus: { span: 12, pier: .9, band: .6, crown: .5, arch: 'broken' }
});

// Original blind arcades, not doors. Each wall remains one cached mesh and
// occupies exactly its existing solid envelope; nothing projects into a hall.
export function createElementalDungeonWallGeometry(type, width, height, depth, quality = 'high') {
    const profile = profiles[type];
    if (!profile) throw new TypeError(`Unsupported dungeon wall: ${type}`);
    if (![width, height, depth].every(value => Number.isFinite(value) && value > 0)) throw new TypeError('Invalid dungeon wall dimensions');
    if (width < 6 || height < 6) return new THREE.BoxGeometry(width, height, depth);
    const parts = [], bays = Math.max(1, Math.min(8, Math.floor(width / profile.span)));
    const span = width / bays, pierWidth = Math.min(profile.pier, span * .16);
    const box = (w, h, d, x, y, z = 0, topDepth = d) => {
        const part = new THREE.BoxGeometry(w, h, d).toNonIndexed();
        const p = part.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * topDepth / d);
        part.translate(x, y - height / 2, z); part.computeVertexNormals(); parts.push(part);
    };
    // Stop the backing at the courses: coincident top faces would sparkle
    // through the crown at gameplay zoom despite correct collision bounds.
    box(width, height - profile.band - profile.crown, depth * .58,
        0, (profile.band + height - profile.crown) / 2);
    // Stepped, sloped ledges catch real light rather than painted highlights.
    box(width, profile.band, depth, 0, profile.band / 2, 0, depth * .84);
    box(width, profile.crown, depth * .84, 0, height - profile.crown / 2, 0, depth);
    const lower = profile.band + .06, upper = height - profile.crown - .06;
    for (let i = 0; i <= bays; i++) {
        const x = THREE.MathUtils.clamp(-width / 2 + i * span,
            -width / 2 + pierWidth / 2, width / 2 - pierWidth / 2);
        box(pierWidth, upper - lower, depth * .88, x, (upper + lower) / 2);
        box(pierWidth * .9, .28, depth * .96, x, lower + .18);
        box(pierWidth * .9, .25, depth * .96, x, upper - .16);
    }
    const radius = Math.min(2.2, span * .27, height * .2);
    const spring = height * (profile.arch === 'spire' ? .4 : .48);
    const base = Math.max(profile.band + .45, height * .1);
    let outline;
    if (profile.arch === 'tide') {
        const steps = quality === 'low' ? 6 : 10;
        outline = Array.from({ length: steps + 1 }, (_, i) => {
            const angle = Math.PI - i * Math.PI / steps;
            return [Math.cos(angle), Math.sin(angle)];
        });
    } else if (profile.arch === 'forge') outline = [[-1, 0], [-1, .45], [-.55, 1], [.55, 1], [1, .45], [1, 0]];
    else if (profile.arch === 'spire') outline = [[-1, 0], [-.8, .4], [0, 1.7], [.8, .4], [1, 0]];
    else outline = [[-1, 0], [-.6, .55], [.2, 1.25], [1, 0]];
    const trim = profile.arch === 'spire' ? .18 : .3, thickness = depth * .13;
    for (let bay = 0; bay < bays; bay++) {
        const x = -width / 2 + (bay + .5) * span;
        for (const side of [-1, 1]) {
            const z = side * depth * .375;
            for (const hand of [-1, 1]) box(trim, spring - base, thickness,
                x + hand * (radius - trim / 2), (spring + base) / 2, z);
            box(radius * 2, .2, thickness, x, base, z);
            for (let i = 0; i < outline.length - 1; i++) {
                const a = outline[i], b = outline[i + 1], inner = radius - trim;
                // Very small mortared joints separate stones. The Umbral
                // central fracture is a missing trim stone, never a wall hole.
                const gap = profile.arch === 'broken' && i === 1 ? .12 : .015;
                const start = a.map((value, axis) => value + (b[axis] - value) * gap);
                const end = b.map((value, axis) => value + (a[axis] - value) * gap);
                const shape = new THREE.Shape([start.map(v => v * radius), end.map(v => v * radius),
                    end.map(v => v * inner), start.map(v => v * inner)].map(point => new THREE.Vector2(...point)));
                const stone = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1 });
                stone.translate(x, spring - height / 2, z - thickness / 2); parts.push(stone);
            }
        }
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        // Resolve equal dominant axes deterministically: a45-degree arch
        // reveal still needs its depth coordinate, not a collapsed XY map.
        const face = az >= ax && az >= ay ? 'z' : ax >= ay ? 'x' : 'y';
        const along = face === 'x' ? p.getZ(i) : p.getX(i);
        const across = face === 'y' ? p.getZ(i) : p.getY(i);
        uv.setXY(i, along / width + .5, across / height + .5);
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.elementalWall = type;
    geometry.userData.archProfile = profile.arch;
    geometry.userData.bays = bays;
    return geometry;
}
