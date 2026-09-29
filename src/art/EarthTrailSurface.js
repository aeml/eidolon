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
    const sx = u * 24, sy = v * 20, cx = Math.floor(sx), cy = Math.floor(sy);
    let stone = 0, stoneTone = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const ix = cx + dx, iy = cy + dy, wy = wrap(iy, 20), seed = hash(ix + 91, wy);
        if (seed < .73 - shoulder * .2) continue;
        const px = sx - ix - hash(ix, wy), py = sy - iy - hash(ix + 73, wy);
        const angle = seed * Math.PI * 2;
        const a = px * Math.cos(angle) - py * Math.sin(angle), b = px * Math.sin(angle) + py * Math.cos(angle);
        const distance = Math.hypot(a / (.18 + seed * .12), b / (.13 + seed * .1));
        const shape = 1 - smooth(.55, 1, distance);
        if (shape > stone) { stone = shape; stoneTone = seed; }
    }
    stone *= .3 + shoulder * .7;
    const shade = .86 + broad * .23 + grit * .09 - tracks * .13;
    const soil = [87, 76, 59].map(value => value * shade);
    const gravel = [106, 102, 90].map(value => value * (.78 + stoneTone * .2));
    return {
        color: soil.map((value, i) => Math.round(value + (gravel[i] - value) * stone)),
        alpha: Math.round(alpha * 215),
        height: .26 + broad * .12 + grit * .06 - tracks * .055 + stone * .17,
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
        const nx = (height(cx - 1, cy) - height(cx + 1, cy)) * 2.5;
        const ny = (height(cx, cy - 1) - height(cx, cy + 1)) * 2.5;
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
