import { createQualityRasterCache } from './QualityRasterCache.js';
import * as THREE from 'three';

const clamp = value => Math.max(0, Math.min(1, value));
const hash = (a, b) => {
    let n = Math.imul(a + 431, 374761393) ^ Math.imul(b + 79, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

const COURSES = [.8, 1.05, .9, 1.2, 1, .85, 1.1, .95, 1.15];
const SLABS = [1.15, 1.7, 1.35, 1.9, 1.45, 1.2, 1.6, 1.55];
const COURSE_LENGTH = COURSES.reduce((sum, value) => sum + value, 0);
const SLAB_LENGTH = SLABS.reduce((sum, value) => sum + value, 0);

function band(value, widths, period, turn = 0) {
    const cycle = Math.floor(value / period), local = value - cycle * period;
    let start = 0;
    for (let index = 0; index < widths.length; index++) {
        const width = widths[(index + turn) % widths.length];
        if (local < start + width || index === widths.length - 1)
            return { id: cycle * widths.length + index, width, offset: local - start };
        start += width;
    }
}

// Human-scale, relaid flagstones with a small worn Fourfold engraving. Keep
// the gathering space open without making its entire floor a giant target.
// This is surface detail only, never walkable height or collision geometry.
export function sampleLanternholdPaving(x, y) {
    const radius = Math.hypot(x, y);
    const weather = Math.sin(x * .43 + Math.sin(y * .28)) * Math.cos(y * .37);
    const warpedY = y + Math.sin(x * .9 + y * .3) * .028;
    // Mixed-height courses and mixed-width stones preserve the original scale.
    // Rotation and offsets keep adjacent courses' repairs and joints distinct.
    const course = band(warpedY, COURSES, COURSE_LENGTH);
    const along = x + hash(course.id, 47) * 3 + Math.sin(y * 1.3) * .024;
    const slab = band(along, SLABS, SLAB_LENGTH, Math.floor(hash(course.id, 19) * SLABS.length));
    const localX = slab.offset, localY = course.offset, width = slab.width;
    const stone = hash(course.id, slab.id), repair = stone > .89;
    const edgeX = Math.min(localX, width - localX), edgeY = Math.min(localY, course.width - localY);
    const chippedCorner = (edgeX + edgeY - (.05 + stone * .08)) * .7;
    const edge = Math.min(edgeX, edgeY, chippedCorner);
    const coverage = clamp((edge - .016) / .05);
    const face = Math.sin(x * 3.6 + Math.cos(y * 4.1)) * Math.cos(y * 5.7) * .003;
    const fracture = stone > .76 && stone < .89 && localX > .15 && localX < width - .12
        ? clamp(1 - Math.abs(localY - (.27 + localX * .32 + Math.sin(localX * 7) * .06)) / .027) : 0;

    // Carved leaves point to the four realms. Worn lines cross the joints
    // instead of replacing them with another raised circular platform.
    const leaf = radius < 3.1 ? Math.min(
        Math.abs(Math.hypot((Math.abs(x) - 1.3) * .8, y * 1.35) - .82),
        Math.abs(Math.hypot(x * 1.35, (Math.abs(y) - 1.3) * .8) - .82)) : 1;
    const engraving = Math.max(clamp(1 - leaf / .065), clamp(1 - Math.abs(radius - 2.65) / .065))
        * clamp((3.1 - radius) * 4) * (.65 + weather * .2);
    const traffic = Math.max(clamp(1 - Math.abs(x + .8) / 3), clamp(1 - Math.abs(y - 1.4) / 3));
    const dirt = (1 - coverage) * (1 - traffic * .5);
    const tone = .94 + stone * .12 + weather * .05;
    const mineral = Math.sin(x * 2.1 + Math.cos(y * 1.8)) * Math.cos(y * 2.8 + Math.sin(x * 1.6));
    const grit = (hash(Math.floor(x * 8), Math.floor(y * 8)) - .5) * 5 + mineral * 5;
    const color = (repair ? [94, 93, 82] : [96, 98, 91]).map((v, i) => Math.round(
        [69, 70, 64][i] * (1 - coverage) +
        (v * tone + grit + traffic * 3 - fracture * 15 - engraving * 25) * coverage + dirt * [4, 3, 0][i]));
    return { color, height: coverage * (.031 + stone * .006 + face - fracture * .012 - engraving * .01),
        roughness: .96 - coverage * (.09 + traffic * .045 + stone * .025),
        coverage: clamp((15.4 - Math.max(Math.abs(x), Math.abs(y)) + weather * .3) / 1.4) };
}

const pavingRaster = createQualityRasterCache(512, 256, size => {
    const length = size * size * 4, data = new Uint8Array(length * 2);
    const color = data.subarray(0, length), surface = data.subarray(length);
    const step = 32 / 512, stride = 512 / size, grid = 514;
    const heights = new Float64Array(grid * grid);
    // Both qualities differentiate the same physical field at +/- one High
    // texel. Adjacent stones share these samples; evaluating five complete
    // color/height recipes per output pixel repeated almost all this work.
    // Keep a one-texel halo for the original non-wrapping court edge normals.
    for (let y = -1; y <= 512; y++) for (let x = -1; x <= 512; x++) {
        if (stride === 2 && x % 2 !== 0 && y % 2 !== 0) continue;
        const sample = sampleLanternholdPaving(x / 512 * 32 - 16, y / 512 * 32 - 16);
        heights[(y + 1) * grid + x + 1] = sample.height;
        if (x < 0 || y < 0 || x >= 512 || y >= 512 || x % stride || y % stride) continue;
        const at = (y / stride * size + x / stride) * 4;
        color.set([...sample.color, Math.round(sample.coverage * 255)], at);
        surface[at + 3] = Math.round(sample.roughness * 255);
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const cell = (y * stride + 1) * grid + x * stride + 1, at = (y * size + x) * 4;
        const nx = -(heights[cell + 1] - heights[cell - 1]) / (2 * step);
        const ny = -(heights[cell + grid] - heights[cell - grid]) / (2 * step);
        const length = Math.hypot(nx, ny, 1);
        surface[at] = Math.round((nx / length * .5 + .5) * 255);
        surface[at + 1] = Math.round((ny / length * .5 + .5) * 255);
        surface[at + 2] = Math.round((1 / length * .5 + .5) * 255);
    }
    return data;
});

export function createLanternholdPavingMaps(quality = 'high') {
    const { size, data } = pavingRaster(quality), length = size * size * 4;
    const color = data.subarray(0, length), surface = data.subarray(length);
    const make = (data, name, colorSpace) => {
        const texture = new THREE.DataTexture(data, size, size);
        texture.name = name; texture.colorSpace = colorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    };
    return { color: make(color, 'Lanternhold fourfold court', THREE.SRGBColorSpace),
        surface: make(surface, 'Lanternhold court normal and roughness', THREE.NoColorSpace) };
}
