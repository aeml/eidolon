import * as THREE from 'three';
import { applyElementalFloorPatina } from './ElementalFloorPatina.js';

const wrap = (value, period) => ((value % period) + period) % period;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x, y) {
    let n = Math.imul(x + 71, 1597334677) ^ Math.imul(y + 23, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
function noise(u, v, cells) {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const f = smooth(0, 1, x - ix), g = smooth(0, 1, y - iy);
    const h = (a, b) => hash(wrap(a, cells), wrap(b, cells));
    return mix(mix(h(ix, iy), h(ix + 1, iy), f), mix(h(ix, iy + 1), h(ix + 1, iy + 1), f), g);
}

// One UV repeat is the existing24m floor span. Mixed-width flagstone courses
// give the broad plazas a quieter surface than a uniform brick checker. All
// signals are periodic, including row offsets and clipped stone corners;
// no painted directional highlights, glowing fractures or displaced floors.
export function sampleDarkRealmStreet(u, v) {
    u = wrap(u, 1); v = wrap(v, 1);
    const weather = noise(u, v, 4), mineral = noise(u, v, 16), grain = noise(u, v, 64);
    const course = v * 8 + (noise(u + .3, v + .7, 8) - .5) * .045;
    const row = Math.floor(course), y = course - row, rowSeed = hash(0, wrap(row, 8));
    const columns = [5, 8, 6, 8][wrap(row, 4)], span = 24 / columns;
    const x = u * columns + (wrap(row, 8) % 2) * .5 + rowSeed * .45 + (noise(u, v, 8) - .5) * .08;
    const column = Math.floor(x), face = x - column;
    const seed = hash(wrap(column, columns), wrap(row, 8));
    const along = Math.min(face, 1 - face) * span, across = Math.min(y, 1 - y) * 3;
    const edge = Math.min(along, across, along + across - .065);
    // Rounded/worn shoulders broaden a shallow joint enough to survive mipmaps.
    const coverage = smooth(.009, .055, edge + (mineral - .5) * .02);
    const rim = (1 - smooth(.055, .13, edge)) * coverage;
    // Broad mineral weathering carries variation. Small differences between
    // individual stones avoid a noisy checker behind actors and ground warnings.
    const tone = 64 + seed * 5 + weather * 14 + mineral * 7;
    return {
        color: [mix(63, tone + 4 + rim * 2, coverage), mix(62, tone + 2 + rim * 2, coverage),
            mix(60, tone + rim, coverage)],
        height: coverage * (.018 + mineral * .004) + grain * .002,
        roughness: mix(.98, .81 + weather * .1 + grain * .04, coverage)
    };
}

export function createDarkRealmStreetMaterial(quality = 'high') {
    const size = quality === 'low' ? 128 : 256;
    const samples = Array.from({ length: size * size }, (_, i) => sampleDarkRealmStreet((i % size + .5) / size, (Math.floor(i / size) + .5) / size));
    const arrays = Array.from({ length: 3 }, () => new Uint8Array(size * size * 4));
    const height = (x, y) => samples[wrap(y, size) * size + wrap(x, size)].height;
    const byte = value => Math.max(0, Math.min(255, Math.round(value)));
    const normal = new THREE.Vector3(), step = 24 / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4, sample = samples[y * size + x];
        normal.set(-(height(x + 1, y) - height(x - 1, y)) / (2 * step),
            -(height(x, y + 1) - height(x, y - 1)) / (2 * step), 1).normalize();
        arrays[0].set([...sample.color.map(byte), 255], i);
        arrays[1].set([byte((normal.x * .5 + .5) * 255), byte((normal.y * .5 + .5) * 255), byte((normal.z * .5 + .5) * 255), 255], i);
        const roughness = byte(sample.roughness * 255);
        arrays[2].set([roughness, roughness, roughness, 255], i);
    }
    const maps = arrays.map((data, i) => {
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.name = `dark-realm-street-${['color', 'normal', 'roughness'][i]}`;
        texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    });
    // Every union rectangle borrows this one scene-owned material/map set.
    // Ordinary scene disposal releases it; no global cache or per-frame work.
    const material = new THREE.MeshStandardMaterial({ map: maps[0], normalMap: maps[1], roughnessMap: maps[2], roughness: 1 });
    material.name = 'Dark Realm worn processional stone';
    material.userData.darkRealmStreet = true;
    return applyElementalFloorPatina(material, 'dark_realm');
}
