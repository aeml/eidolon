import * as THREE from 'three';

// For owned, static, planar ground-effect meshes only. Rigid particles and
// animated scaling surfaces need a different placement contract.
export function conformGroundEffectMesh(mesh, field, originGroundHeight) {
    mesh.updateWorldMatrix(true, false);
    const source = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    source.translate(0, -originGroundHeight, 0);
    const conformed = conformGroundRibbon(source, field);
    source.dispose();
    conformed.applyMatrix4(mesh.matrixWorld.clone().invert());
    mesh.geometry.dispose();
    mesh.geometry = conformed;
}

// Clip each ribbon face against the terrain cells AND their diagonal. Merely
// raising coarse endpoints creates chords that bury roads inside hills. UVs
// interpolate from the original ribbon so seams do not restart the texture.
export function conformGroundRibbon(source, field) {
    const positions = source.attributes.position, texcoords = source.attributes.uv;
    const output = [], uv = [];
    const clip = (polygon, distance) => {
        const result = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const da = distance(a), db = distance(b);
            if (da >= 0) result.push(a);
            if ((da >= 0) !== (db >= 0)) {
                const t = da / (da - db);
                result.push(a.map((value, index) => value + (b[index] - value) * t));
            }
        }
        return result;
    };
    const emit = polygon => {
        for (let i = 1; i + 1 < polygon.length; i++) {
            const tri = [polygon[0], polygon[i], polygon[i + 1]];
            const [a, b, c] = tri;
            if (Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) < 1e-10) continue;
            for (const p of tri) {
                output.push(p[0], p[1] + field.sample(p[0], p[2]), p[2]);
                uv.push(p[3], p[4]);
            }
        }
    };
    const vertexCount = source.index?.count ?? positions.count;
    for (let index = 0; index < vertexCount; index += 3) {
        const tri = [0, 1, 2].map(offset => {
            const i = source.index ? source.index.getX(index + offset) : index + offset;
            return [positions.getX(i), positions.getY(i), positions.getZ(i), texcoords.getX(i), texcoords.getY(i)];
        });
        const columnAt = x => Math.max(-1, Math.min(field.columns, Math.floor((x - field.minX) / field.stepX)));
        const rowAt = z => Math.max(-1, Math.min(field.rows, Math.floor((z - field.minZ) / field.stepZ)));
        const firstColumn = columnAt(Math.min(...tri.map(p => p[0])));
        const lastColumn = columnAt(Math.max(...tri.map(p => p[0])));
        const firstRow = rowAt(Math.min(...tri.map(p => p[2])));
        const lastRow = rowAt(Math.max(...tri.map(p => p[2])));
        // Sentinel cells cover level ground outside the raised realm bounds.
        for (let column = firstColumn; column <= lastColumn; column++) {
            const left = column < 0 ? -Infinity : field.minX + column * field.stepX;
            const right = column >= field.columns ? Infinity : field.minX + (column + 1) * field.stepX;
            let strip = clip(tri, p => p[0] - left);
            strip = clip(strip, p => right - p[0]);
            for (let row = firstRow; row <= lastRow; row++) {
                const top = row < 0 ? -Infinity : field.minZ + row * field.stepZ;
                const bottom = row >= field.rows ? Infinity : field.minZ + (row + 1) * field.stepZ;
                let cell = clip(strip, p => p[2] - top);
                cell = clip(cell, p => bottom - p[2]);
                if (column < 0 || column >= field.columns || row < 0 || row >= field.rows) emit(cell);
                else {
                    const diagonal = p => (p[0] - left) / field.stepX + (p[2] - top) / field.stepZ - 1;
                    emit(clip(cell, p => -diagonal(p)));
                    emit(clip(cell, diagonal));
                }
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
