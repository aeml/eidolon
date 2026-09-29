import * as THREE from 'three';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (value, period) => (value % period + period) % period;
const hash = (x, y) => {
    let n = Math.imul(x + 53, 1597334677) ^ Math.imul(y + 127, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};
function noise(x, y, cells) {
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy);
    const sample = (a, b) => hash(a, wrap(b, cells));
    const a = sample(ix, iy), b = sample(ix + 1, iy), c = sample(ix, iy + 1), d = sample(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Canonical coordinates: across the ribbon and along a six-metre repeat.
// All fields wrap longitudinally, including neighboring gravel at the seam.
// These are shallow material relief, never walk blockers or simulated terrain.
export function sampleEarthTrail(x, y) {
    y = wrap(y, 256);
    const u = x / 256, v = y / 256;
    const broad = noise(u * 7, v * 6, 6), grit = noise(u * 31, v * 24, 24);
    const wander = (noise(u * 2, v * 4, 4) - .5) * .045;
    const tracks = Math.exp(-Math.pow((u - .29 - wander) / .065, 2))
        + Math.exp(-Math.pow((u - .71 - wander) / .065, 2));
    const shoulder = smooth(.16, .39, Math.abs(u - .5));
    const edge = Math.min(u, 1 - u);
    const alpha = smooth(.012 + broad * .1, .16 + broad * .12, edge);
    // Larger half-buried aggregate reads at play zoom; tiny grain alone
    // disappears into the soil's mean color after mip filtering.
    const sx = u * 16, sy = v * 14, cx = Math.floor(sx), cy = Math.floor(sy);
    let stone = 0, stoneTone = 0, stoneFace = 0, crevice = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const ix = cx + dx, iy = cy + dy, wy = wrap(iy, 14), seed = hash(ix + 91, wy);
        if (seed < .75 - shoulder * .22 + (broad - .5) * .3) continue;
        const px = sx - ix - hash(ix, wy), py = sy - iy - hash(ix + 73, wy);
        const angle = seed * Math.PI * 2;
        const a = px * Math.cos(angle) - py * Math.sin(angle), b = px * Math.sin(angle) + py * Math.cos(angle);
        const ax = a / (.24 + seed * .14), by = b / (.18 + seed * .12);
        // Unequal clipped facets avoid both round pebbles and square tiles.
        const distance = Math.max(Math.abs(ax), Math.abs(by), Math.abs(ax + by * .63) * .76);
        const shape = 1 - smooth(.68, 1, distance);
        crevice = Math.max(crevice, (1 - smooth(.95, 1.24, distance)) * smooth(.62, 1, distance));
        if (shape > stone) {
            stone = shape; stoneTone = seed;
            stoneFace = clamp(.55 + ax * .17 - by * .2);
        }
    }
    stone *= (.36 + shoulder * .64) * (.45 + smooth(.2, .7, broad) * .55);
    const shade = .83 + broad * .27 + grit * .12 - tracks * .17 - crevice * .11;
    const soil = [94, 81, 62].map(value => value * shade);
    const gravel = [108, 104, 93].map(value => value * (.72 + stoneTone * .16 + stoneFace * .14));
    return {
        color: soil.map((value, i) => Math.round(value + (gravel[i] - value) * stone)),
        alpha: Math.round(alpha * 245),
        height: .26 + broad * .12 + grit * .06 - tracks * .07 + stone * (.12 + stoneFace * .1),
        roughness: .94 - tracks * .13 - stone * .09
    };
}

export function createEarthTrailMaps(quality = 'high') {
    const canonical = 256, size = quality === 'low' ? 128 : 256;
    const samples = Array.from({ length: canonical * canonical }, (_, i) => sampleEarthTrail(i % canonical, Math.floor(i / canonical)));
    const pixels = [0, 1, 2].map(() => new Uint8Array(size * size * 4));
    const height = (x, y) => samples[wrap(y, canonical) * canonical + Math.max(0, Math.min(canonical - 1, x))].height;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const cx = x * canonical / size, cy = y * canonical / size, at = (y * size + x) * 4;
        const sample = samples[cy * canonical + cx];
        pixels[0].set([...sample.color, sample.alpha], at);
        const nx = (height(cx - 1, cy) - height(cx + 1, cy)) * .85;
        const ny = (height(cx, cy - 1) - height(cx, cy + 1)) * .85;
        const length = Math.hypot(nx, ny, 1);
        pixels[1].set([Math.round((nx / length * .5 + .5) * 255), Math.round((ny / length * .5 + .5) * 255),
            Math.round((1 / length * .5 + .5) * 255), 255], at);
        const rough = Math.round(sample.roughness * 255);
        pixels[2].set([rough, rough, rough, 255], at);
    }
    const maps = {};
    ['map', 'normalMap', 'roughnessMap'].forEach((key, i) => {
        const texture = new THREE.DataTexture(pixels[i], size, size);
        texture.name = `Earth compacted trail:${key}:${quality}`;
        texture.colorSpace = i ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        maps[key] = texture;
    });
    return maps;
}
