import * as THREE from 'three';

// Separate rigid sections follow the existing thigh/knee bones. The greave is
// a front half-shell with an inner return, not a cone buried in the calf.
export function createLegSectionGeometry(section = 'thigh') {
    const profiles = {
        thigh: [[0, -.83], [.19, -.83], [.205, -.70], [.245, -.4], [.265, -.12], [.25, .015], [0, .015]],
        shin: [[0, -.77], [.135, -.77], [.145, -.63], [.19, -.35], [.20, -.08], [.19, .015], [0, .015]],
        greave: [[.16, -.69], [.195, -.40], [.225, -.15], [.21, -.035],
            [.19, -.035], [.205, -.15], [.175, -.40], [.14, -.69], [.16, -.69]]
    };
    if (!profiles[section]) throw new Error(`Unknown leg section: ${section}`);
    const shell = section === 'greave';
    const shape = new THREE.LatheGeometry(profiles[section].map(p => new THREE.Vector2(...p)),
        shell ? 12 : 20, 0, shell ? Math.PI : Math.PI * 2);
    if (shell) shape.rotateY(-Math.PI / 2);
    shape.scale(1, 1, .9);
    return shape;
}

export function createClothMantleGeometry(border = false) {
    const profile = [[0, .2], [.15, .17], [.3, .09], [.41, -.04], [.44, -.19], [.45, -.24]];
    const rows = (border ? profile.slice(-2) : profile).reverse();
    const shape = new THREE.LatheGeometry(rows.map(p => new THREE.Vector2(...p)), 24);
    const positions = shape.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const angle = Math.atan2(x, z), radius = Math.hypot(x, z);
        const drape = Math.max(0, (.2 - y) / .44);
        const fold = .008 * drape * Math.sin(angle * 8) + (border ? .002 : 0);
        const scale = radius > 0 ? (radius + fold) / radius : 1;
        positions.setXYZ(i, x * scale, y + .02 * drape * Math.cos(angle * 6), z * scale * .88);
    }
    shape.computeVertexNormals();
    // The UV seam duplicates vertices; join their lighting normals after folding.
    const normals = shape.attributes.normal;
    for (let row = 0; row < rows.length; row++) {
        const last = 24 * rows.length + row;
        const normal = new THREE.Vector3().fromBufferAttribute(normals, row)
            .add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
        normals.setXYZ(row, normal.x, normal.y, normal.z);
        normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
    return shape;
}

export function createGreatHelmGeometry() {
    const profile = [[.34, -.155], [.36, 0], [.37, .25], [.35, .34], [.26, .43], [0, .495]];
    return new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 24);
}

const BOOT_UPPER_PROFILE = [[.04, .19, -.18, .52], [.10, .185, -.17, .50],
    [.17, .165, -.16, .40], [.24, .14, -.15, .25], [.32, .13, -.14, .12],
    [.32, .105, -.115, .095], [.24, .115, -.125, .225]];

// Shared with inset equipment ornaments; no duplicated approximate boot shape.
export function fittedBootFrontDepth(x, y) {
    const surface = row => (row[3] + row[2]) / 2 + (row[3] - row[2]) / 2
        * Math.cbrt(Math.max(0, 1 - (Math.abs(x) / row[1]) ** 3));
    for (let i = 1; i <= 4; i++) {
        const a = BOOT_UPPER_PROFILE[i - 1], b = BOOT_UPPER_PROFILE[i];
        if (y <= b[0] || i === 4) {
            const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
            return THREE.MathUtils.lerp(surface(a), surface(b), t);
        }
    }
}

// Rounded toe, raised instep and open ankle instead of a box plus a toe sphere.
// Ring rows share samples so the toe overlay follows the upper's actual faces.
export function createFittedBootGeometry(part = 'upper') {
    const upper = BOOT_UPPER_PROFILE;
    const rows = part === 'sole' ? [[-.02, .18, -.17, .51], [.005, .20, -.19, .54], [.04, .19, -.18, .52]]
        : part === 'toe' ? upper.slice(0, 3) : upper;
    if (!['upper', 'sole', 'toe'].includes(part)) throw new Error(`Unknown boot part: ${part}`);
    const columns = part === 'toe' ? 8 : 24;
    const positions = [], uvs = [], indices = [];
    const rounded = value => Math.sign(value) * Math.abs(value) ** (2 / 3);
    for (let row = 0; row < rows.length; row++) {
        const [y, width, back, front] = rows[row];
        for (let col = 0; col <= columns; col++) {
            const angle = (part === 'toe' ? col - 4 : col) * Math.PI / 12;
            const overlay = part === 'toe' ? 1.015 : 1;
            positions.push(width * rounded(Math.sin(angle)) * overlay,
                y + (part === 'toe' ? .003 : 0),
                (front + back) / 2 + (front - back) / 2 * rounded(Math.cos(angle)) * overlay);
            uvs.push(col / columns, row / (rows.length - 1));
            if (row < rows.length - 1 && col < columns) {
                const a = row * (columns + 1) + col, b = a + columns + 1;
                indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }
    // A real outsole closes the bottom; the ankle opening remains uncapped.
    if (part === 'sole') {
        const center = positions.length / 3;
        positions.push(0, rows[0][0], (rows[0][2] + rows[0][3]) / 2); uvs.push(.5, .5);
        for (let col = 0; col < columns; col++) indices.push(center, col + 1, col);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.setIndex(indices); result.computeVertexNormals();
    if (part !== 'toe') {
        const normals = result.attributes.normal, average = new THREE.Vector3();
        for (let row = 0; row < rows.length; row++) {
            const a = row * (columns + 1), b = a + columns;
            average.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
            normals.setXYZ(a, average.x, average.y, average.z); normals.setXYZ(b, average.x, average.y, average.z);
        }
    }
    return result;
}

// Hollow wrist armor leaves the shared curled fingers and weapon grip exposed.
// The return profile models the inside and rolled lip without double-sided
// rendering. The upper flare overlaps the existing forearm, not the palm.
export function createWristCuffGeometry(rim = false) {
    const profile = rim
        ? [[.198, .165], [.211, .19], [.212, .225], [.184, .225], [.181, .19], [.198, .165]]
        : [[.137, -.025], [.16, .015], [.183, .08], [.198, .165], [.202, .21],
            [.177, .21], [.173, .165], [.157, .08], [.134, .015], [.112, -.025], [.137, -.025]];
    const result = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 16);
    result.scale(1, 1, .9);
    return result;
}

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
    const hemBorder = border === 'hem';
    const columns = border === true ? 1 : 16;
    const rows = hemBorder ? 1 : 10;
    const positions = [], uvs = [], indices = [];
    for (let row = 0; row <= rows; row++) {
        const v = hemBorder ? .9 + .1 * row : row / rows;
        for (let column = 0; column <= columns; column++) {
            // Match the panel's columns exactly, so the border cannot dip
            // beneath a coarser triangle between sample points.
            const u = border === true ? .75 + .0625 * column / columns : column / columns;
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
    const result = new THREE.LatheGeometry(profiles[part].toReversed().map(([x, y]) => new THREE.Vector2(x, y)), 12);
    result.scale(1, 1, .85);
    return result;
}
