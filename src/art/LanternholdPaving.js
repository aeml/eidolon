import * as THREE from 'three';

const clamp = value => Math.max(0, Math.min(1, value));
const hash = (a, b) => {
    let n = Math.imul(a + 431, 374761393) ^ Math.imul(b + 79, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Human-scale, relaid flagstones with a small worn Fourfold engraving. Keep
// the gathering space open without making its entire floor a giant target.
// This is surface detail only, never walkable height or collision geometry.
export function sampleLanternholdPaving(x, y) {
    const radius = Math.hypot(x, y);
    const weather = Math.sin(x * .43 + Math.sin(y * .28)) * Math.cos(y * .37);
    const warpedY = y + Math.sin(x * .9 + y * .3) * .028;
    const row = Math.floor(warpedY / 1.05), localY = warpedY - row * 1.05;
    const width = 1.25 + hash(row, 19) * .7;
    const along = x + hash(row, 47) * 3 + Math.sin(y * 1.3) * .024;
    const column = Math.floor(along / width), localX = along - column * width;
    const stone = hash(row, column), repair = stone > .89;
    const edgeX = Math.min(localX, width - localX), edgeY = Math.min(localY, 1.05 - localY);
    const chippedCorner = (edgeX + edgeY - (.07 + stone * .1)) * .7;
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
    const tone = .9 + stone * .18 + weather * .07;
    const mineral = Math.sin(x * 2.1 + Math.cos(y * 1.8)) * Math.cos(y * 2.8 + Math.sin(x * 1.6));
    const grit = (hash(Math.floor(x * 8), Math.floor(y * 8)) - .5) * 5 + mineral * 5;
    const color = (repair ? [94, 93, 82] : [96, 98, 91]).map((v, i) => Math.round(
        [62, 63, 55][i] * (1 - coverage) +
        (v * tone + grit + traffic * 3 - fracture * 15 - engraving * 25) * coverage + dirt * [4, 3, 0][i]));
    return { color, height: coverage * (.031 + stone * .006 + face - fracture * .012 - engraving * .01),
        roughness: .96 - coverage * (.09 + traffic * .045 + stone * .025),
        coverage: clamp((15.4 - Math.max(Math.abs(x), Math.abs(y)) + weather * .3) / 1.4) };
}

export function createLanternholdPavingMaps(quality = 'high') {
    const size = quality === 'low' ? 256 : 512;
    const color = new Uint8Array(size * size * 4), surface = new Uint8Array(color.length);
    const step = 32 / 512;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const px = x / size * 32 - 16, py = y / size * 32 - 16;
        const sample = sampleLanternholdPaving(px, py), at = (y * size + x) * 4;
        color.set([...sample.color, Math.round(sample.coverage * 255)], at);
        const nx = -(sampleLanternholdPaving(px + step, py).height - sampleLanternholdPaving(px - step, py).height) / (2 * step);
        const ny = -(sampleLanternholdPaving(px, py + step).height - sampleLanternholdPaving(px, py - step).height) / (2 * step);
        const length = Math.hypot(nx, ny, 1);
        surface.set([Math.round((nx / length * .5 + .5) * 255),
            Math.round((ny / length * .5 + .5) * 255), Math.round((1 / length * .5 + .5) * 255),
            Math.round(sample.roughness * 255)], at);
    }
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
