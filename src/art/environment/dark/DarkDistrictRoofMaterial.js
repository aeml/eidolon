import * as THREE from 'three';

export const DARK_DISTRICT_ROOF_SPAN = 8;
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

// Eight metres per repeat:1m slates in staggered half-metre courses. Color
// describes mineral/soot variation; normal relief supplies the lapped lip.
// No painted directional highlights, emissive seams or displaced roof surface.
export function sampleDarkDistrictRoof(u, v) {
    u = wrap(u); v = wrap(v);
    const weather = noise(u, v, 4), mineral = noise(u, v, 16), grain = noise(u, v, 64);
    const course = v * 16, row = Math.floor(course), down = course - row;
    const across = u * 8 + wrap(row, 16) % 2 * .5;
    const column = Math.floor(across), face = across - column;
    const seed = hash(wrap(column, 8), wrap(row, 16));
    const joint = Math.min(face, 1 - face);
    const coverage = smooth(.003, .018, Math.min(joint, down * .5, (1 - down) * .5));
    const tone = 53 + seed * 15 + weather * 10 + mineral * 7;
    return {
        color: [mix(36, tone, coverage), mix(39, tone + 5, coverage), mix(46, tone + 13, coverage)],
        height: coverage * (.006 + down * .012) + grain * .0015,
        roughness: mix(.98, .82 + weather * .10 + mineral * .04, coverage)
    };
}

export function createDarkDistrictRoofMaterial(quality = 'high') {
    const size = quality === 'low' ? 128 : 256;
    const samples = Array.from({ length: size * size }, (_, i) =>
        sampleDarkDistrictRoof((i % size + .5) / size, (Math.floor(i / size) + .5) / size));
    const arrays = Array.from({ length: 3 }, () => new Uint8Array(size * size * 4));
    const height = (x, y) => samples[wrap(y, size) * size + wrap(x, size)].height;
    const byte = x => Math.max(0, Math.min(255, Math.round(x)));
    const normal = new THREE.Vector3(), step = DARK_DISTRICT_ROOF_SPAN / size;
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
    const maps = arrays.map((data, i) => {
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.name = `dark-district-roof-${['color', 'normal', 'roughness'][i]}`;
        texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    });
    // One scene-owned map set for all32roofs. Ordinary resource retirement
    // owns these maps; no global cache, time uniform or per-frame update.
    const material = new THREE.MeshStandardMaterial({ map: maps[0], normalMap: maps[1],
        roughnessMap: maps[2], roughness: 1, metalness: .025 });
    material.name = 'Dark Realm weathered slate roofs';
    material.userData.darkDistrictRoof = true;
    return material;
}
