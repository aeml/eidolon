import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, cold communal pottery furnaces. All solid parts remain within the
// old 5m square footprint. The firebox is a recess, not a walking entrance.
function builder() {
    const parts = [];
    const add = (geometry, color, x = 0, y = 0, z = 0) => {
        const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose(); baked.translate(x, y, z);
        const value = new THREE.Color(color), colors = [];
        for (let i = 0; i < baked.attributes.position.count; i++) colors.push(value.r, value.g, value.b);
        baked.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        parts.push(baked);
    };
    return { add, box: (w, h, d, color, x, y, z) => add(new THREE.BoxGeometry(w, h, d), color, x, y, z),
        finish: () => {
            if (!parts.length) {
                const geometry = new THREE.BufferGeometry();
                for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
                    geometry.setAttribute(key, new THREE.Float32BufferAttribute([], size));
                }
                return geometry;
            }
            const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
            geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
        } };
}

// Radial masonry block, including end faces. The joints follow construction
// instead of projecting an unrelated brick grid across a curved furnace.
function wedge(inner, outer, start, end, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(start) * outer, Math.sin(start) * outer);
    shape.absarc(0, 0, outer, start, end, false);
    shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    shape.absarc(0, 0, inner, end, start, true); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2, steps: 1 });
}

export function createKilnFurnaceGeometry({ quality = 'high' } = {}) {
    const stone = builder(), iron = builder(), segments = quality === 'low' ? 12 : 20;
    stone.box(4.9, .24, 4.9, 0x655b50, 0, .12, 0);
    const shades = [0x877563, 0x74695c, 0x95816d, 0x807264, 0x706356];
    for (let row = 0; row < 8; row++) {
        const y = .25 + row * .4, radius = 2.3 - row * .14;
        const count = 16, shift = row % 2 * Math.PI / count;
        for (let i = 0; i < count; i++) {
            const angle = i / count * Math.PI * 2 + shift;
            // Leave a true opening towards +Z below the arch crown. Checking
            // block extents rather than centers prevents a corner sealing it.
            const frontDistance = Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2)));
            if (row < 5 && frontDistance < .61 + Math.PI / count) continue;
            const block = wedge(radius - .38, radius, angle - Math.PI / count + .014, angle + Math.PI / count - .014, .375);
            block.rotateX(Math.PI / 2);
            stone.add(block, shades[(i * 3 + row * 2) % shades.length], 0, y + .375, 0);
        }
    }
    // Jambs and individual voussoirs frame the recessed firebox.
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
        stone.box(.72, .375, .85, shades[(row + 1) % shades.length],
            side * (1.36 - row * .055), .4375 + row * .4, 1.4);
    }
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
        stone.box(.35, .32, .64, shades[(row + 2) % shades.length], side * .93, .43 + row * .34, 1.85);
    }
    for (let i = 0; i < 9; i++) stone.add(wedge(.75, 1.11, i / 9 * Math.PI + .015,
        (i + 1) / 9 * Math.PI - .015, .64), shades[i % shades.length], 0, 1.12, 1.53);
    stone.box(2.2, .16, 1.15, 0x514a43, 0, .3, 1.66);
    stone.box(2.25, 1.8, .12, 0x1d1c1a, 0, 1.18, .78);
    stone.box(1.5, .05, .6, 0x252422, 0, .42, 1.2);
    for (let i = -2; i <= 2; i++) iron.box(.07, .08, 1, 0xb0a393, i * .26, .5, 1.42);
    // A hollow iron flue, visible rim and straps; no opaque cap pretending to
    // be an exhaust opening. Everything remains inside the former 5.8m crown.
    const profile = [[.94, 3.4], [.84, 3.55], [.7, 3.62], [.62, 5.55], [.7, 5.62],
        [.7, 5.77], [.52, 5.77], [.52, 5.58], [.59, 3.63]];
    iron.add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), 0xffffff);
    for (const [radius, y] of [[1.9, 1.48], [1.31, 3.18], [.65, 4.28]]) {
        const band = new THREE.TorusGeometry(radius, .065, 4, segments, y === 1.48 ? Math.PI * 2 - 1.3 : Math.PI * 2);
        if (y === 1.48) band.rotateZ(Math.PI / 2 + .65);
        band.rotateX(Math.PI / 2);
        iron.add(band, 0xc3b8a5, 0, y, 0);
    }
    return { masonry: stone.finish(), iron: iron.finish() };
}

export function createKilnDryingRackGeometry({ quality = 'high' } = {}) {
    const timber = builder(), pottery = builder(), segments = quality === 'low' ? 8 : 16;
    for (const x of [-2.12, 2.12]) for (const z of [-.93, .93]) timber.box(.22, 1.4, .22, 0xffffff, x, .7, z);
    for (const y of [.43, 1.48]) {
        for (let i = 0; i < 5; i++) timber.box(4.9, .13, .45, 0xdac8b1, 0, y, -1 + i * .5);
        for (const x of [-2.12, 2.12]) timber.box(.2, .23, 2.5, 0xffffff, x, y - .15, 0);
    }
    for (let i = 0; i < 7; i++) {
        const height = .55 + (i % 3) * .22, radius = .28 + (i % 2) * .12;
        const profile = [[.15, 0], [radius * .8, .05], [radius, height * .46], [radius * .68, height * .82],
            [radius * .65, height], [radius * .44, height], [radius * .43, height * .82], [.07, .09]];
        const vessel = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
        pottery.add(vessel, [0x9c7355, 0xb18a64, 0x807665][i % 3], -1.8 + (i % 4) * 1.1, 1.56, i < 4 ? -.56 : .6);
    }
    for (let i = 0; i < 4; i++) pottery.box(.7, .22, 1.1, 0x927f67, -1.55 + i * 1.02, .62, .15);
    return { wood: timber.finish(), masonry: pottery.finish() };
}

// Low broken yard paving and loading aprons bind the workshops together.
// Never a raised walk floor; callers exclude roads, hazards and the quest room.
export function createKilnYardPaving(isClear) {
    const paving = builder();
    for (let row = 0; row < 16; row++) for (let column = 0; column < 19; column++) {
        const x = (column - 9) * 1.65 + (row % 2) * .7, z = -14 + row * 1.7;
        const seed = (Math.imul(row + 5, 73856093) ^ Math.imul(column + 11, 19349663)) >>> 0;
        if (Math.abs(x) < 4.4 && z > -4.4 && z < 3.8) continue;
        if (!isClear(x, z, 1.25)) continue;
        // Coherent loading bays linked by worn strips, not independently
        // scattered tiles. Eroded edges and occasional missing stones expose
        // the soil without turning the yard into a regular checkerboard.
        const workshop = Math.min(Math.hypot(Math.abs(x) - 12, z + 8), Math.hypot(Math.abs(x) - 12, z - 9));
        const bay = 1 - workshop / 6.5;
        const sideLane = (1 - Math.abs(Math.abs(x) - 12) / 3.3) * (z > -11 && z < 10 ? 1 : 0);
        const crossLane = (1 - Math.abs(z + 5.5) / 2.8) * (Math.abs(x) < 13 ? 1 : 0);
        if (Math.max(bay, sideLane, crossLane) < .12 + (seed % 19) / 100 || seed % 31 === 0) continue;
        const chip = .1 + seed % 9 * .035, shape = new THREE.Shape();
        shape.moveTo(-.74 + chip, -.75); shape.lineTo(.74 - chip * .5, -.75);
        shape.lineTo(.74, -.75 + chip); shape.lineTo(.74, .75 - chip * 1.3);
        shape.lineTo(.74 - chip, .75); shape.lineTo(-.74 + chip * .7, .75);
        shape.lineTo(-.74, .75 - chip); shape.lineTo(-.74, -.75 + chip * 1.5); shape.closePath();
        const slab = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: false, steps: 1 });
        slab.rotateX(-Math.PI / 2);
        slab.rotateY(((seed % 7) - 3) * .012);
        paving.add(slab, [0x514a40, 0x584e43, 0x5d5146, 0x575148][seed % 4], x, .014, z);
    }
    return paving.finish();
}
