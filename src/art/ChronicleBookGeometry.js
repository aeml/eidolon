import * as THREE from 'three';

// Folded, curled paper and writing follow the same surface. Keep the entire
// spread inside the old evidence book; no new walking or selection bounds.
const pageHeight = (t, z, side) => .018 + .05 * (1 - t) ** 3
    + .018 * t ** 4 + Math.sin(z * 5 + side) * .007 * t * t;
const point = (t, z, side, lift = 0) => [side * (.035 + t * .515), pageHeight(t, z, side) + lift, z];

export function createChronicleBookGeometry() {
    const pages = [], ink = [];
    const triangle = (target, a, b, c, side) => target.push(...a, ...(side > 0 ? c : b), ...(side > 0 ? b : c));
    const quad = (target, a, b, c, d, side) => {
        triangle(target, a, b, c, side); triangle(target, b, d, c, side);
    };
    for (const side of [-1, 1]) {
        const columns = 5, rows = 3;
        for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
            const t = x / columns, next = (x + 1) / columns;
            const near = -.38 + z / rows * .76, far = -.38 + (z + 1) / rows * .76;
            quad(pages, point(t, near, side), point(next, near, side),
                point(t, far, side), point(next, far, side), side);
        }
        // Closed paper stack, including the curved outer page edges.
        const perimeter = [];
        for (let i = 0; i <= columns; i++) perimeter.push(point(i / columns, -.38, side));
        for (let i = 1; i <= rows; i++) perimeter.push(point(1, -.38 + i / rows * .76, side));
        for (let i = columns - 1; i >= 0; i--) perimeter.push(point(i / columns, .38, side));
        for (let i = rows - 1; i > 0; i--) perimeter.push(point(0, -.38 + i / rows * .76, side));
        for (let i = 0; i < perimeter.length; i++) {
            const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
            const bottom = p => [p[0], -.012, p[2]];
            triangle(pages, a, bottom(a), b, side); triangle(pages, b, bottom(a), bottom(b), side);
        }
        quad(pages, [side * .035, -.012, -.38], [side * .55, -.012, -.38],
            [side * .035, -.012, .38], [side * .55, -.012, .38], -side);
        for (let line = 0; line < 4; line++) {
            const start = .17, end = .83 - (line % 2) * .1, z = -.23 + line * .12;
            // Two segments track the fold, so ink no longer floats horizontally
            // above tilted pages. Quiet varying line lengths avoid a ruled grid.
            for (let i = 0; i < 2; i++) {
                const a = start + (end - start) * i / 2, b = start + (end - start) * (i + 1) / 2;
                quad(ink, point(a, z, side, .002), point(b, z, side, .002),
                    point(a, z + .012, side, .002), point(b, z + .012, side, .002), side);
            }
        }
    }
    const geometry = values => {
        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
        result.computeVertexNormals();
        const p = result.attributes.position, n = result.attributes.normal;
        // Continuous paper lighting, with the stack's vertical edges and bottom
        // still sharp. Analytic derivatives avoid visible tessellation patches.
        for (let i = 0; i < p.count; i++) if (n.getY(i) > .9) {
            const side = Math.sign(p.getX(i)), t = (Math.abs(p.getX(i)) - .035) / .515, z = p.getZ(i);
            const along = -.15 * (1 - t) ** 2 + .072 * t ** 3 + Math.sin(z * 5 + side) * .014 * t;
            const across = Math.cos(z * 5 + side) * .035 * t * t;
            const normal = new THREE.Vector3(-side * along / .515, 1, -across).normalize();
            n.setXYZ(i, normal.x, normal.y, normal.z);
        }
        result.computeBoundingBox(); result.computeBoundingSphere();
        return result;
    };
    return { pages: geometry(pages), ink: geometry(ink) };
}
