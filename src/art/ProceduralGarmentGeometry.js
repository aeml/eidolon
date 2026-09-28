import * as THREE from 'three';

/** Fitted rings follow the waist, ribcage, shoulder roll and open neckline.
 * The open neckline avoids the broad flat lid of a tapered cylinder. Callers
 * own caching so the same garment can be shared by local and remote actors.
 */
export function createTailoredTorsoGeometry(waist, chest, height, neck = chest * 0.4) {
    const profile = [
        [waist, -height * 0.5],
        [waist * 0.97, -height * 0.4],
        [waist * 0.96, -height * 0.27],
        [(waist + chest) * 0.5, -height * 0.08],
        [chest, height * 0.12],
        [chest * 0.99, height * 0.24],
        [chest * 0.94, height * 0.34],
        [chest * 0.76, height * 0.43],
        [neck, height * 0.5]
    ];
    return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24);
}

/** A hanging cloth panel and its inset woven border use the same surface.
 * Shallow folds stay outside the leg; no simulation, new bones or per-frame
 * allocations. The continuous hem and UVs also work for future cloth textures.
 */
export function createDrapedSkirtGeometry(border = false) {
    const columns = border ? 1 : 16;
    const rows = 10;
    const positions = [], uvs = [], indices = [];
    for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        for (let column = 0; column <= columns; column++) {
            // Match the panel's columns exactly, so the border cannot dip
            // beneath a coarser triangle between sample points.
            const u = border ? .75 + .0625 * column / columns : column / columns;
            const width = .54 + .055 * Math.sin(v * Math.PI);
            const hem = 1.36 - .065 * Math.sin(u * Math.PI * 2);
            const fold = .018 * (1 - Math.cos(u * Math.PI * 6)) * (.25 + .75 * v);
            positions.push((u - .5) * width, .04 - v * hem, fold + .016 * v * v + (border ? .002 : 0));
            uvs.push(u, 1 - v);
            if (row < rows && column < columns) {
                const a = row * (columns + 1) + column, b = a + columns + 1;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
}

/** Two separate inlaid eyes in one draw call; not a luminous visor bar. */
export function createPairedEyesGeometry(width, height, separation) {
    const shapes = [-1, 1].map((side) => {
        const x = side * separation / 2;
        const shape = new THREE.Shape();
        shape.moveTo(x - width / 2, 0);
        shape.lineTo(x, height / 2);
        shape.lineTo(x + width / 2, 0);
        shape.lineTo(x, -height / 2);
        shape.closePath();
        return shape;
    });
    return new THREE.ShapeGeometry(shapes);
}

export function createOpenHoodGeometry() {
    return new THREE.LatheGeometry(
        [[0.42, -0.12], [0.44, 0.25], [0.33, 0.52], [0.08, 0.68], [0, 0.7]]
            .map(([radius, y]) => new THREE.Vector2(radius, y)),
        12, 0.72, Math.PI * 2 - 1.44
    );
}

// Thin, overlapping armor shells rather than solid polyhedra. The profile
// returns along the inside, so raised arms expose a real inner surface without
// double-sided materials. Callers cache each part and attach it to the shoulder.
export function createPauldronGeometry(part = 'shell') {
    const profiles = {
        shell: [[0, .24], [.19, .22], [.34, .14], [.43, .015], [.45, -.08],
            [.415, -.085], [.395, .005], [.315, .11], [.18, .185], [0, .205]],
        rim: [[.434, -.015], [.458, -.07], [.452, -.105], [.414, -.105],
            [.421, -.07], [.405, -.015], [.434, -.015]],
        lame: [[.385, -.065], [.405, -.17], [.375, -.275], [.34, -.285],
            [.342, -.25], [.373, -.165], [.355, -.065], [.385, -.065]]
    };
    if (!profiles[part]) throw new Error(`Unknown pauldron part: ${part}`);
    const result = new THREE.LatheGeometry(profiles[part].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    result.scale(1, 1, .85);
    return result;
}
