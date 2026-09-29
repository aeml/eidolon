import * as THREE from 'three';

const clamp = value => Math.max(0, Math.min(1, value));
const hash = (a, b) => {
    let n = Math.imul(a + 431, 374761393) ^ Math.imul(b + 79, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// The gathering square is an old, repaired fourfold stonework court. Rings
// are construction courses, not emissive objectives or collision geometry.
export function sampleLanternholdPaving(x, y) {
    const radius = Math.hypot(x, y), angle = Math.atan2(y, x) + Math.PI;
    const courses = [0, 1.4, 3.1, 5.2, 7, 9.2, 11.1, 13.5, 15.5, 24];
    const wornRadius = radius + Math.sin(angle * 5 + radius * .8) * .055;
    const course = Math.max(0, courses.findIndex(bound => bound > wornRadius) - 1);
    const inner = courses[course], outer = courses[course + 1];
    const sectors = Math.max(7, Math.round((inner + outer) * Math.PI / 2.2));
    const along = angle / (Math.PI * 2) * sectors + (course % 2) * .5;
    const sector = Math.floor(along) % sectors, fraction = along - Math.floor(along);
    const radialEdge = Math.min(wornRadius - inner, outer - wornRadius);
    const edge = Math.min(radialEdge, Math.min(fraction, 1 - fraction) * 2.2);
    const coverage = clamp((edge - .012) / .065);
    const stone = hash(course, sector);
    const weather = Math.sin(x * .41 + Math.sin(y * .28)) * Math.cos(y * .37);
    // A single outer border, with the fourfold inlay confined to the centre.
    const band = Math.abs(radius - 14.8) < .13;
    const spoke = radius > 1.6 && radius < 3 && Math.min(Math.abs(x), Math.abs(y)) < .13;
    const dark = band || spoke;
    const tone = .72 + stone * .38 + weather * .07;
    const fracture = stone > .73 && fraction > .18 && fraction < .82
        ? clamp(1 - Math.abs(wornRadius - inner - (outer - inner) * (.25 + fraction * .5)) / .045) : 0;
    const grit = Math.sin(x * 17 + Math.sin(y * 13)) * Math.cos(y * 19) * 1.2;
    const color = (dark ? [76, 77, 68] : [109, 106, 92]).map((v, i) =>
        Math.round([68, 64, 54][i] * (1 - coverage) + (v * tone + grit - fracture * 12) * coverage));
    return { color, height: coverage * (.065 + stone * .009),
        roughness: .96 - coverage * (.13 + stone * .035),
        coverage: clamp((15.5 - radius) / .5) };
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
