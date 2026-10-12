import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLanternholdBenchPlank } from './LanternholdUtilityGeometry.js';
import { createChronicleBookGeometry } from './ChronicleBookGeometry.js';

// Material-keyed, scene-owned parts. The four courts retain their ordinary
// occupations and existing walking solids; none of these props is interactive.
function builder() {
    const batches = new Map();
    const add = (key, source, position = [0, 0, 0], angle = 0, color = 0xffffff) => {
        source.rotateY(angle); source.translate(...position); source.normalizeNormals();
        const geometry = source.index ? source.toNonIndexed() : source.clone(); source.dispose();
        const p = geometry.attributes.position;
        if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(p.count * 2, 2));
        if ((key === 'paper' || key === 'cloth') && !geometry.attributes.color) {
            const tint = new THREE.Color(color), colors = new Float32Array(p.count * 3);
            for (let i = 0; i < p.count; i++) colors.set([tint.r, tint.g, tint.b], i * 3);
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        const parts = batches.get(key) || []; parts.push(geometry); batches.set(key, parts);
    };
    const box = (key, size, position, angle = 0, color = 0xffffff) => add(key, new THREE.BoxGeometry(...size), position, angle, color);
    const plank = (key, size, position) => add(key, createLanternholdBenchPlank(...size), position);
    const finish = () => Object.fromEntries([...batches].map(([key, parts]) => {
        const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return [key, geometry];
    }));
    return { add, box, plank, finish };
}

function openBook(build, x, z, scale = 1) {
    const book = createChronicleBookGeometry();
    for (const [part, key] of [[book.pages, 'paper'], [book.ink, 'shadow']]) {
        part.scale(scale, scale, scale); build.add(key, part, [x, 1.34, z]);
    }
    build.box('cloth', [1.14 * scale, .035, .8 * scale], [x, 1.3175, z]);
}

function closedBook(build, x, y, z, angle = 0) {
    const part = (key, geometry, offset) => { geometry.translate(...offset); build.add(key, geometry, [x, y, z], angle); };
    part('paper', createLanternholdBenchPlank(.72, .18, .93), [0, 0, 0]);
    for (const side of [-1, 1]) part('cloth', createLanternholdBenchPlank(.84, .045, 1.02), [0, side * .115, 0]);
    const spine = new THREE.CylinderGeometry(.135, .135, 1.02, 8); spine.rotateX(Math.PI / 2);
    part('cloth', spine, [-.34, 0, 0]);
    for (const end of [-1, 1]) part('bronze', new THREE.BoxGeometry(.055, .02, .99), [end * .22, .148, 0]);
}

function loaf(build, x, z, quality) {
    const sides = quality === 'low' ? 10 : 16;
    const dome = new THREE.SphereGeometry(1, sides, quality === 'low' ? 5 : 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(.35, .28, .52); build.add('paper', dome, [x, 1.3, z], 0, 0xffd49f);
    const bottom = new THREE.CircleGeometry(1, sides); bottom.rotateX(Math.PI / 2); bottom.scale(.35, 1, .52);
    build.add('paper', bottom, [x, 1.3, z], 0, 0xc38d58);
    for (const cut of [-.2, 0, .2]) {
        const score = new THREE.PlaneGeometry(.35, .025, 4, 1); score.rotateX(-Math.PI / 2);
        const p = score.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const px = p.getX(i), pz = p.getZ(i) + cut;
            p.setXYZ(i, px, .28 * Math.sqrt(Math.max(0, 1 - (px / .35) ** 2 - (pz / .52) ** 2)) + .002, pz);
        }
        score.computeVertexNormals(); build.add('paper', score, [x, 1.3, z], 0, 0xb77744);
    }
}

export function createDarkCourtWorkbenchGeometry(recipe, quality = 'high') {
    if (!['shore', 'archive', 'foundry', 'city'].includes(recipe)) throw new Error(`Unknown Dark Realm court: ${recipe}`);
    const build = builder();
    // Three broad boards, aprons and four braced feet carry the work surface.
    // Their full extent remains inside the existing4x2.5x2.5m bench solid.
    for (const z of [-.79, 0, .79]) build.plank('timber', [3.88, .16, .75], [0, 1.22, z]);
    for (const x of [-1.63, 1.63]) {
        for (const z of [-.88, .88]) {
            build.box('timber', [.18, 1.05, .18], [x, .625, z]);
            build.box('bronze', [.2, .16, .025], [x, 1.04, z + Math.sign(z) * .1]);
        }
        build.box('timber', [.18, .14, 1.96], [x, .39, 0]);
        build.box('timber', [.18, .2, 2.05], [x, 1.04, 0]);
    }
    for (const z of [-.88, .88]) build.box('timber', [3.45, .2, .12], [0, 1.04, z]);
    if (recipe === 'shore') {
        // Four genuinely hollow cups beside the passenger list, not gold cubes.
        for (const x of [-1.35, -.45, .45, 1.35]) {
            const cup = new THREE.LatheGeometry([[.055, 0], [.15, .025], [.18, .3], [.135, .3], [.11, .065], [.055, .065]]
                .map(([r, y]) => new THREE.Vector2(r, y)), quality === 'low' ? 8 : 12);
            build.add('bronze', cup, [x, 1.3, .55]);
            for (const [y, angle] of [[1.3, Math.PI / 2], [1.365, -Math.PI / 2]]) {
                const floor = new THREE.CircleGeometry(.055, quality === 'low' ? 8 : 12); floor.rotateX(angle);
                build.add('bronze', floor, [x, y, .55]);
            }
            const handle = new THREE.TorusGeometry(.09, .025, 4, 8);
            build.add('bronze', handle, [x + .18, 1.46, .55]);
        }
        openBook(build, 0, -.45, 1.1);
    } else if (recipe === 'archive') {
        closedBook(build, -.92, 1.4375, -.1, -.06);
        closedBook(build, -.92, 1.7125, -.08, .05);
        closedBook(build, .74, 1.4375, -.1, .09);
        openBook(build, .74, .61, .8);
    } else if (recipe === 'foundry') {
        const shape = new THREE.Shape();
        const profile = [[-.48, 0], [.48, 0], [.2, .17], [.2, .39], [.55, .49], [.73, .65], [.56, .72], [-.43, .72], [-1.08, .57], [-.4, .43], [-.18, .37], [-.18, .16]];
        profile.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
        const anvil = new THREE.ExtrudeGeometry(shape, { depth: .66, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1 });
        anvil.translate(0, .025, -.33); build.add('shadow', anvil, [-.6, 1.3, -.15]);
        build.plank('bronze', [1.04, .045, .68], [-.54, 2.075, -.15]);
        // Two unused tongs, pivot and hammer rest on the boards, not in midair.
        for (const x of [.72, 1.32]) {
            for (const side of [-1, 1]) build.box('shadow', [.055, .07, 1.18], [x + side * .09, 1.34, 0], -side * .1);
            const pivot = new THREE.CylinderGeometry(.065, .065, .085, 8);
            build.add('bronze', pivot, [x, 1.35, .35]);
        }
        build.box('timber', [.065, .065, 1.2], [.05, 1.335, 0]);
        build.plank('shadow', [.48, .25, .26], [.05, 1.425, .47]);
    } else {
        // Three counted loaves and one extra welcome at the front of the table.
        for (const x of [-1.1, 0, 1.1]) loaf(build, x, -.5, quality);
        loaf(build, 1.15, .61, quality); openBook(build, -.75, .55, .85);
    }
    return build.finish();
}

export function createDarkCourtStandardGeometry(recipe, quality = 'high') {
    if (!['shore', 'archive', 'foundry', 'city'].includes(recipe)) throw new Error(`Unknown Dark Realm court: ${recipe}`);
    const build = builder();
    build.plank('stone', [1.9, .18, 1.9], [0, .19, 0]);
    build.plank('stone', [1.5, .5, 1.5], [0, .53, 0]);
    build.plank('stone', [1.6, .12, 1.6], [0, .84, 0]);
    build.add('bronze', new THREE.CylinderGeometry(.075, .11, 4.94, quality === 'low' ? 8 : 12), [0, 3.23, -.07]);
    const rail = new THREE.CylinderGeometry(.045, .045, 1.55, 8); rail.rotateZ(Math.PI / 2);
    build.add('bronze', rail, [0, 5.72, 0]);
    build.add('bronze', new THREE.SphereGeometry(.09, 8, 4), [0, 5.84, -.07]);
    // Static folded cloth, closed front/back with stitched edge thickness.
    // Pinned at the crossbar; no clock or cloth simulation can jitter the hem.
    const front = new THREE.PlaneGeometry(1.25, 2.1, quality === 'low' ? 4 : 8, quality === 'low' ? 6 : 10);
    const p = front.attributes.position, colors = new Float32Array(p.count * 3);
    const tint = new THREE.Color({ shore: 0x9baab2, archive: 0xc0adbf, foundry: 0xc6a58d, city: 0xb9b3a4 }[recipe]);
    for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / 1.25 + .5, v = p.getY(i) / 2.1 + .5, drop = 1 - v;
        p.setXYZ(i, p.getX(i), 3.62 + v * 2.1 - .05 * Math.sin(u * Math.PI) * drop,
            .045 * Math.sin(u * Math.PI * 4) * drop + .018 * Math.sin(v * Math.PI * 3) * Math.sin(u * Math.PI));
        const hem = Math.min(u, 1 - u, v, 1 - v) < .08 ? .83 : 1;
        colors.set([tint.r * hem, tint.g * hem, tint.b * hem], i * 3);
    }
    front.setAttribute('color', new THREE.BufferAttribute(colors, 3)); front.computeVertexNormals();
    const back = front.clone(); back.translate(0, 0, -.025);
    for (let i = 0; i < back.index.count; i += 3) {
        const a = back.index.getX(i); back.index.setX(i, back.index.getX(i + 2)); back.index.setX(i + 2, a);
    }
    back.computeVertexNormals();
    const columns = quality === 'low' ? 4 : 8, rows = quality === 'low' ? 6 : 10, perimeter = [];
    for (let x = 0; x <= columns; x++) perimeter.push(x);
    for (let y = 1; y <= rows; y++) perimeter.push(y * (columns + 1) + columns);
    for (let x = columns - 1; x >= 0; x--) perimeter.push(rows * (columns + 1) + x);
    for (let y = rows - 1; y > 0; y--) perimeter.push(y * (columns + 1));
    const edges = [];
    const point = (index, back = false) => [p.getX(index), p.getY(index), p.getZ(index) - (back ? .025 : 0)];
    for (let i = 0; i < perimeter.length; i++) {
        const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
        edges.push(...point(a), ...point(b), ...point(a, true), ...point(b), ...point(b, true), ...point(a, true));
    }
    const edge = new THREE.BufferGeometry(); edge.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3)); edge.computeVertexNormals();
    build.add('cloth', edge, [0, 0, 0], 0, tint.clone().multiplyScalar(.83));
    build.add('cloth', front); build.add('cloth', back);
    return build.finish();
}
