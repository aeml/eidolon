import * as THREE from 'three';

export const DARK_DISTRICT_MASONRY_SPAN = 8;
const wrap = (x, period = 1) => ((x % period) + period) % period;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
function hash(x, y) {
    let n = Math.imul(x + 43, 1597334677) ^ Math.imul(y + 79, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
function noise(u, v, cells) {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const f = smooth(0, 1, x - ix), g = smooth(0, 1, y - iy);
    const h = (a, b) => hash(wrap(a, cells), wrap(b, cells));
    return mix(mix(h(ix, iy), h(ix + 1, iy), f), mix(h(ix, iy + 1), h(ix + 1, iy + 1), f), g);
}

// Eight physical metres per repeat: broad2m blocks in1m staggered courses.
// Shallow recessed mortar, worn shoulders and muted mineral variation provide
// separate relief/albedo/roughness signals without painted lighting or movement.
export function sampleDarkDistrictMasonry(u, v) {
    u = wrap(u); v = wrap(v);
    const weather = noise(u, v, 4), mineral = noise(u, v, 16), grain = noise(u, v, 64);
    const course = v * 8, row = Math.floor(course), up = course - row;
    const across = u * 4 + (row % 2) * .5;
    const column = Math.floor(across), face = across - column;
    const seed = hash(wrap(column, 4), wrap(row, 8));
    const edge = Math.min(face * 2, (1 - face) * 2, up, 1 - up);
    const coverage = smooth(.014, .055, edge + (mineral - .5) * .01);
    const tone = 63 + seed * 13 + weather * 10 + mineral * 6;
    return {
        color: [mix(45, tone, coverage), mix(44, tone - 2, coverage), mix(51, tone + 6, coverage)],
        height: coverage * (.024 + mineral * .006) + grain * .0015,
        roughness: mix(.99, .84 + weather * .08 + mineral * .04, coverage)
    };
}

// Face-aligned metric coordinates keep the same course height on walls,
// buttresses and clipped corners. Nonindexed flat faces retain every original
// position/normal; only UVs change. The horizontal axis follows each face.
export function applyDarkDistrictMasonryUV(geometry) {
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
        const horizontal = Math.hypot(nx, nz);
        uv[i * 2] = (horizontal < .01 ? x : (x * nz - z * nx) / horizontal) / DARK_DISTRICT_MASONRY_SPAN;
        uv[i * 2 + 1] = (horizontal < .01 ? -z * Math.sign(ny) : y) / DARK_DISTRICT_MASONRY_SPAN;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
}

// Two private immutable recipes, bounded to960KiB. Each scene receives its own
// texture storage; disposal or mutation cannot affect the recipes or another
// scene. Returning to a district does not regenerate all mineral samples.
const pixelsBySize = new Map();
function masonryPixels(size) {
    if (pixelsBySize.has(size)) return pixelsBySize.get(size);
    const samples = Array.from({ length: size * size }, (_, i) =>
        sampleDarkDistrictMasonry((i % size + .5) / size, (Math.floor(i / size) + .5) / size));
    const arrays = Array.from({ length: 3 }, () => new Uint8Array(size * size * 4));
    const height = (x, y) => samples[wrap(y, size) * size + wrap(x, size)].height;
    const byte = x => Math.max(0, Math.min(255, Math.round(x)));
    const normal = new THREE.Vector3(), step = DARK_DISTRICT_MASONRY_SPAN / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4, sample = samples[y * size + x];
        normal.set(-(height(x + 1, y) - height(x - 1, y)) / (2 * step),
            -(height(x, y + 1) - height(x, y - 1)) / (2 * step), 1).normalize();
        arrays[0].set([...sample.color.map(byte), 255], i);
        arrays[1].set([byte((normal.x * .5 + .5) * 255), byte((normal.y * .5 + .5) * 255),
            byte((normal.z * .5 + .5) * 255), 255], i);
        const roughness = byte(sample.roughness * 255);
        arrays[2].set([roughness, roughness, roughness, 255], i);
    }
    pixelsBySize.set(size, arrays);
    return arrays;
}

export function createDarkDistrictMasonryMaterial(quality = 'high') {
    const size = quality === 'low' ? 128 : 256;
    const maps = masonryPixels(size).map((data, i) => {
        const texture = new THREE.DataTexture(new Uint8Array(data), size, size, THREE.RGBAFormat);
        texture.name = `dark-district-masonry-${['color', 'normal', 'roughness'][i]}`;
        texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    });
    // One scene-owned map set for all32buildings. Ordinary resource retirement
    // owns these maps; no shared GPU textures, time uniform or per-frame update.
    const material = new THREE.MeshStandardMaterial({ map: maps[0], normalMap: maps[1],
        roughnessMap: maps[2], roughness: 1, metalness: 0 });
    material.name = 'Dark Realm dressed basalt masonry';
    material.userData.darkDistrictMasonry = true;
    return material;
}
