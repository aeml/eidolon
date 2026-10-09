import { MeshoptSimplifier } from 'meshoptimizer';

// Index-only candidate: surviving supplied attributes, bone palette and skin
// weights remain exact. Weighted errors constrain interpolation; they do not
// prove every posed surface is equivalent. Native motion/fit review is separate.
export function weightedWearableIndices(primitive, ratio, error, protectedVertices = null) {
    const position = primitive.getAttribute('POSITION'), positions = position.getArray();
    const indices = new Uint32Array(primitive.getIndices().getArray()), count = position.getCount();
    if (primitive.getMode() !== 4 || primitive.listTargets().length || !(positions instanceof Float32Array)) return null;
    const semantics = primitive.listSemantics().filter(name => !['POSITION', 'JOINTS_0', 'WEIGHTS_0'].includes(name));
    if (semantics.some(name => !['NORMAL', 'TEXCOORD_0'].includes(name))) return null;
    const joints = primitive.getAttribute('JOINTS_0'), skinWeights = primitive.getAttribute('WEIGHTS_0');
    if (Boolean(joints) !== Boolean(skinWeights)) return null;
    const blends = [], signatures = [];
    for (let vertex = 0; vertex < count; vertex++) {
        const blend = new Map(), js = joints?.getElement(vertex, []) || [], ws = skinWeights?.getElement(vertex, []) || [];
        for (let channel = 0; channel < js.length; channel++) {
            if (!Number.isInteger(js[channel]) || js[channel] < 0 || !Number.isFinite(ws[channel]) || ws[channel] < 0) return null;
            if (ws[channel] !== 0) blend.set(js[channel], (blend.get(js[channel]) || 0) + ws[channel]);
        }
        blends.push(blend); signatures.push(JSON.stringify([...blend].sort((a, b) => a[0] - b[0])));
    }
    const bones = [...new Set(blends.flatMap(blend => [...blend.keys()]))].sort((a, b) => a - b);
    const widths = semantics.map(name => primitive.getAttribute(name).getElementSize());
    const attributeWidth = widths.reduce((sum, width) => sum + width, 0), stride = attributeWidth + bones.length;
    if (stride > 32) return null;
    const values = new Float32Array(count * stride), weights = [];
    semantics.forEach((name, index) => { for (let i = 0; i < widths[index]; i++) weights.push(name === 'NORMAL' ? .05 : .1); });
    weights.push(...bones.map(() => .1));
    for (let vertex = 0; vertex < count; vertex++) {
        let offset = vertex * stride;
        for (const name of semantics) {
            const row = primitive.getAttribute(name).getElement(vertex, []); values.set(row, offset); offset += row.length;
        }
        bones.forEach((bone, index) => { values[vertex * stride + attributeWidth + index] = blends[vertex].get(bone) || 0; });
    }
    const remap = MeshoptSimplifier.generatePositionRemap(positions, 3), conflicts = new Set(), locks = new Uint8Array(count);
    for (let vertex = 0; vertex < count; vertex++) if (signatures[vertex] !== signatures[remap[vertex]]) conflicts.add(remap[vertex]);
    for (let vertex = 0; vertex < count; vertex++) if (conflicts.has(remap[vertex])) locks[vertex] = 1;
    const lockedSkinSeamVertices = locks.reduce((sum, value) => sum + value, 0);
    if (protectedVertices) {
        if (protectedVertices.length !== count) throw new Error('Invalid material seam lock roster');
        for (let vertex = 0; vertex < count; vertex++) if (protectedVertices[vertex]) locks[vertex] = 1;
    }
    const target = Math.floor(indices.length * ratio / 3) * 3;
    const [result, reportedError] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3,
        values, stride, weights, locks, target, error, ['LockBorder', 'Permissive']);
    if (result.length > indices.length || !Number.isFinite(reportedError) || reportedError > error) throw new Error('Invalid weighted simplification result');
    return { indices: result, reportedError, lockedSkinSeamVertices,
        lockedVertices: locks.reduce((sum, value) => sum + value, 0), activeBones: bones.length };
}

// Independently simplified overlapping cloth/trim surfaces can lose their
// ordering even while each primitive meets its own geometric error. Preserve
// supplied vertices in a guard band around other material surfaces instead.
// This is only an experimental constraint; visual review remains mandatory.
export function materialSeamLocks(primitive, siblings, error) {
    const positions = primitive.getAttribute('POSITION').getArray(), locks = new Uint8Array(positions.length / 3);
    const other = siblings.filter(part => part !== primitive && part.getMaterial() !== primitive.getMaterial());
    if (!other.length) return locks;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) { min[i % 3] = Math.min(min[i % 3], positions[i]); max[i % 3] = Math.max(max[i % 3], positions[i]); }
    const radius = 2 * error * Math.max(...max.map((value, i) => value - min[i]));
    if (!(radius > 0)) return locks;
    const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    for (const part of other) {
        const source = part.getAttribute('POSITION').getArray();
        for (let i = 0; i < source.length; i += 3) {
            const point = [source[i], source[i + 1], source[i + 2]], cell = key(...point.map(value => Math.floor(value / radius)));
            if (!grid.has(cell)) grid.set(cell, []);
            grid.get(cell).push(point);
        }
    }
    for (let vertex = 0; vertex < locks.length; vertex++) {
        const point = Array.from(positions.subarray(vertex * 3, vertex * 3 + 3)), cell = point.map(value => Math.floor(value / radius));
        search: for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
            for (const other of grid.get(key(cell[0] + x, cell[1] + y, cell[2] + z)) || []) {
                if (point.reduce((sum, value, i) => sum + (value - other[i]) ** 2, 0) <= radius ** 2) { locks[vertex] = 1; break search; }
            }
        }
    }
    return locks;
}
