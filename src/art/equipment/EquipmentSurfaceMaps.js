import * as THREE from 'three';

// Small, immutable, process-lifetime surfaces, shared with the equipment and
// humanoid caches. No item-specific textures, network assets or frame updates.
// UV-space detail survives rigid batching and follows the actor during motion.
const CACHE = new Map();
const SIZE = 64;
const RELIEF = Object.freeze({ cloth: .003, leather: .006, metal: .002, wood: .005 });
const tau = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

function noise(u, v, cells) {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const hash = (a, b) => {
        const n = Math.sin((a % cells) * 127.1 + (b % cells) * 311.7) * 43758.5453;
        return n - Math.floor(n);
    };
    const f = x - ix, g = y - iy, sx = f * f * (3 - 2 * f), sy = g * g * (3 - 2 * g);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}

export function getEquipmentSurfaceMaps(surface) {
    if (!Object.hasOwn(RELIEF, surface)) throw new TypeError(`Unknown equipment surface: ${surface}`);
    if (CACHE.has(surface)) return CACHE.get(surface);
    const color = new Uint8Array(SIZE * SIZE * 4), roughness = new Uint8Array(color.length), height = new Uint8Array(color.length);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const u = (x + .5) / SIZE, v = (y + .5) / SIZE;
        const broad = noise(u, v, 8), fine = noise(u, v, 32);
        const grain = surface === 'cloth' ? .15 * fine + .85 * (.5 + .5 * Math.sin(u * tau * 16) * Math.sin(v * tau * 16)) :
            surface === 'wood' ? .5 + .5 * Math.sin(u * tau * 12 + broad * 2) :
                surface === 'leather' ? .65 * fine + .35 * broad : .85 * broad + .15 * fine;
        const values = [Math.round(226 + 29 * (.65 * broad + .35 * grain)),
            Math.round(214 + 41 * (surface === 'metal' ? broad : grain)), Math.round(grain * 255)];
        for (const [index, data] of [color, roughness, height].entries()) {
            const offset = (y * SIZE + x) * 4;
            data[offset] = data[offset + 1] = data[offset + 2] = values[index]; data[offset + 3] = 255;
        }
    }
    const texture = (data, channel) => {
        const result = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
        result.name = `EquipmentSurface:${surface}:${channel}`;
        result.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        result.wrapS = result.wrapT = THREE.RepeatWrapping;
        result.minFilter = THREE.LinearMipmapLinearFilter; result.magFilter = THREE.LinearFilter;
        result.generateMipmaps = true; result.needsUpdate = true;
        return result;
    };
    const maps = Object.freeze({ map: texture(color, 'color'), roughnessMap: texture(roughness, 'roughness'),
        bumpMap: texture(height, 'height'), bumpScale: RELIEF[surface] });
    CACHE.set(surface, maps);
    return maps;
}
