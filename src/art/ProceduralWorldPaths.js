import * as THREE from 'three';
import { EARTH_PATHS } from '../data/worldPopulation.js';

function pathTexture() {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const seed = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
        const grain = (seed % 101) / 100;
        const edge = Math.min(x, size - 1 - x) / size;
        const wear = Math.max(0, Math.min(1, (edge - .025 - grain * .035) / .15));
        const rut = Math.exp(-Math.pow((x / size - .29) * 23, 2)) + Math.exp(-Math.pow((x / size - .71) * 23, 2));
        const shade = .79 + grain * .22 - rut * .09;
        const i = (y * size + x) * 4;
        pixels[i] = 115 * shade; pixels[i + 1] = 102 * shade; pixels[i + 2] = 79 * shade;
        pixels[i + 3] = 235 * wear;
    }
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    texture.name = 'Earth path · worn loam and cart ruts';
    return texture;
}

// Continuous ribbon with mitered joins: no overlapping segment quads at bends.
// Centerline vertices are subdivided for culling-friendly, inspectable geometry;
// UV distance is in world units so long paths do not stretch the surface grain.
export function createWorldPathGeometry(path) {
    if (!Number.isFinite(path?.width) || path.width <= 0 || !Array.isArray(path.points) || path.points.length < 2 ||
        path.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
        throw new TypeError('A world path requires a positive width and finite centerline');
    }
    const points = [path.points[0]];
    for (let i = 1; i < path.points.length; i++) {
        const [ax, az] = points.at(-1), [bx, bz] = path.points[i];
        const length = Math.hypot(bx - ax, bz - az);
        if (length < .001) continue;
        const steps = Math.ceil(length / 32);
        for (let j = 1; j <= steps; j++) points.push([ax + (bx - ax) * j / steps, az + (bz - az) * j / steps]);
    }
    if (points.length < 2) throw new TypeError('A world path must have nonzero length');
    const position = [], uv = [], indices = [];
    let distance = 0;
    const normal = (a, b) => {
        const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        return [-dz / length, dx / length];
    };
    points.forEach(([x, z], i) => {
        if (i) distance += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
        const before = normal(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
        const after = normal(points[Math.min(i, points.length - 2)], points[Math.min(i + 1, points.length - 1)]);
        let nx = before[0] + after[0], nz = before[1] + after[1];
        const length = Math.hypot(nx, nz);
        if (length < .01) throw new TypeError('A world path cannot reverse at a join');
        nx /= length; nz /= length;
        const halfWidth = path.width / 2 / Math.max(.5, nx * after[0] + nz * after[1]);
        position.push(x + nx * halfWidth, .035, z + nz * halfWidth, x - nx * halfWidth, .035, z - nz * halfWidth);
        uv.push(0, distance / 6, 1, distance / 6);
        if (i) { const p = (i - 1) * 2; indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return geometry;
}

export function createEarthPathNetwork() {
    const group = new THREE.Group(); group.name = 'Earth authored paths';
    const material = new THREE.MeshStandardMaterial({ map: pathTexture(), roughness: 1,
        transparent: true, alphaTest: .025, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    material.name = 'Earth worn-path surface';
    for (const path of EARTH_PATHS) {
        const mesh = new THREE.Mesh(createWorldPathGeometry(path), material);
        mesh.name = `world-path:${path.id}`; mesh.receiveShadow = true;
        mesh.userData.worldPathId = path.id;
        group.add(mesh);
    }
    // Scene ownership is local; no global texture/material cache can be
    // invalidated by leaving this world and disposing its resources.
    return group;
}
