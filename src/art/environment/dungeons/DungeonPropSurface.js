import * as THREE from 'three';

const wrap = (value, period) => ((value % period) + period) % period;
const mix = (a, b, t) => a + (b - a) * t;
function noise(u, v, cells) {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const hash = (a, b) => {
        let n = Math.imul(wrap(a, cells) + 71, 1597334677) ^ Math.imul(wrap(b, cells) + 23, 3812015801);
        n = Math.imul(n ^ n >>> 16, 2246822519);
        return ((n ^ n >>> 13) >>> 0) / 4294967296;
    };
    const f = x - ix, g = y - iy, sx = f * f * (3 - 2 * f), sy = g * g * (3 - 2 * g);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}

// Seamless mineral grain and shallow forge marks. Albedo, relief and roughness
// are distinct signals; no directional lighting or emissive marks are baked in.
export function sampleDungeonPropSurface(surface, u, v) {
    if (surface !== 'stone' && surface !== 'metal') throw new TypeError(`Unknown dungeon prop surface: ${surface}`);
    u = wrap(u, 1); v = wrap(v, 1);
    const broad = noise(u, v, 8), fine = noise(u, v, 32), weather = noise(u, v, 4);
    if (surface === 'stone') return {
        color: [225 + broad * 24, 224 + broad * 24, 219 + broad * 28],
        height: broad * .4 + fine * .15,
        roughness: .84 + fine * .08 + weather * .04
    };
    return {
        color: [210 + broad * 40, 207 + broad * 40 - weather * 15, 199 + broad * 42 - weather * 22],
        height: broad * .15 + fine * .06,
        roughness: .46 + weather * .28 + fine * .08
    };
}

// Kit-owned maps are shared by every room's stone/iron material, then released
// by normal material disposal. No global cache, room-specific textures or clock.
export function createDungeonPropSurfaceMaps(surface, quality = 'high') {
    sampleDungeonPropSurface(surface, 0, 0); // reject unsupported roles before allocation
    const size = quality === 'low' ? 64 : 128, step = 1 / size;
    const arrays = Array.from({ length: 3 }, () => new Uint8Array(size * size * 4));
    const normal = new THREE.Vector3();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + .5) / size, v = (y + .5) / size, sample = sampleDungeonPropSurface(surface, u, v);
        const du = (sampleDungeonPropSurface(surface, u + step, v).height - sampleDungeonPropSurface(surface, u - step, v).height) / (2 * step);
        const dv = (sampleDungeonPropSurface(surface, u, v + step).height - sampleDungeonPropSurface(surface, u, v - step).height) / (2 * step);
        normal.set(-du * .015, -dv * .015, 1).normalize();
        const channels = [sample.color, [normal.x, normal.y, normal.z].map(value => (value * .5 + .5) * 255),
            Array(3).fill(sample.roughness * 255)];
        for (let channel = 0; channel < 3; channel++) {
            const offset = (y * size + x) * 4;
            for (let component = 0; component < 3; component++) arrays[channel][offset + component] = Math.round(channels[channel][component]);
            arrays[channel][offset + 3] = 255;
        }
    }
    const keys = ['map', 'normalMap', 'roughnessMap'];
    return Object.fromEntries(keys.map((key, index) => {
        const texture = new THREE.DataTexture(arrays[index], size, size, THREE.RGBAFormat);
        texture.name = `DungeonProp:${surface}:${key}`;
        texture.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return [key, texture];
    }));
}
