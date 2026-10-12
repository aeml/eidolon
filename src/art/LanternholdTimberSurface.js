import * as THREE from 'three';

export const LANTERNHOLD_TIMBER_SPAN = Object.freeze([2, 8]);
const wrap = (x, period = 1) => ((x % period) + period) % period;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = x => x * x * (3 - 2 * x);
function hash(x, y) {
    let n = Math.imul(x + 53, 1597334677) ^ Math.imul(y + 97, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
function noise(u, v, across, along) {
    const x = wrap(u) * across, y = wrap(v) * along;
    const ix = Math.floor(x), iy = Math.floor(y), f = smooth(x - ix), g = smooth(y - iy);
    const h = (a, b) => hash(wrap(a, across), wrap(b, along));
    return mix(mix(h(ix, iy), h(ix + 1, iy), f), mix(h(ix, iy + 1), h(ix + 1, iy + 1), f), g);
}

// Long, interrupted fibres and broad weathering. Color contains no painted
// highlights; shallow physical relief and roughness remain separate signals.
export function sampleLanternholdTimber(u, v) {
    u = wrap(u); v = wrap(v);
    const weather = noise(u, v, 4, 4), warp = noise(u, v, 8, 8);
    const fibre = noise(u + (warp - .5) * .045, v, 64, 8);
    const grain = noise(u + (warp - .5) * .025, v, 32, 4);
    const split = Math.max(0, .22 - fibre) * noise(u, v, 16, 16);
    const tone = 78 + weather * 30 + grain * 14 + fibre * 9 - split * 50;
    return { color: [tone, tone * .79, tone * .56],
        height: (fibre - .5) * .0018 - split * .0025,
        roughness: .84 + weather * .10 + split * .15 };
}

// Map each construction piece before baking its transform. Vertical boards
// and horizontal beams keep fibres along their own long axis, at physical
// scale, instead of inheriting stretched BoxGeometry UVs or world-facing grain.
export function mapLanternholdTimberUV(geometry, scale, phase = [0, 0, 0]) {
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
    const long = size.indexOf(Math.max(...size)), position = geometry.attributes.position;
    const normal = geometry.attributes.normal, uv = new Float32Array(position.count * 2);
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (let i = 0; i < position.count; i++) {
        const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
        const face = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
        const v = face === long ? (long + 2) % 3 : long;
        const u = [0, 1, 2].find(axis => axis !== face && axis !== v);
        const sign = Math.sign(axes[u].clone().cross(axes[v]).getComponent(face) * n[face]);
        uv[i * 2] = (position.getComponent(i, u) * scale * sign + phase[0] * .37 + phase[2] * .19) / LANTERNHOLD_TIMBER_SPAN[0];
        uv[i * 2 + 1] = (position.getComponent(i, v) * scale + phase[0] * 1.13 + phase[2] * .71 + phase[1] * .23) / LANTERNHOLD_TIMBER_SPAN[1];
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
}

export function createLanternholdTimberMaterials(quality = 'high') {
    const size = quality === 'low' ? 128 : 256;
    const samples = Array.from({ length: size * size }, (_, i) =>
        sampleLanternholdTimber((i % size + .5) / size, (Math.floor(i / size) + .5) / size));
    const arrays = Array.from({ length: 3 }, () => new Uint8Array(size * size * 4));
    const height = (x, y) => samples[wrap(y, size) * size + wrap(x, size)].height;
    const byte = n => Math.max(0, Math.min(255, Math.round(n)));
    const normal = new THREE.Vector3();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4, sample = samples[y * size + x];
        normal.set(-(height(x + 1, y) - height(x - 1, y)) / (2 * LANTERNHOLD_TIMBER_SPAN[0] / size),
            -(height(x, y + 1) - height(x, y - 1)) / (2 * LANTERNHOLD_TIMBER_SPAN[1] / size), 1).normalize();
        arrays[0].set([...sample.color.map(byte), 255], i);
        arrays[1].set([byte((normal.x * .5 + .5) * 255), byte((normal.y * .5 + .5) * 255), byte((normal.z * .5 + .5) * 255), 255], i);
        const roughness = byte(sample.roughness * 255);
        arrays[2].set([roughness, roughness, roughness, 255], i);
    }
    const maps = arrays.map((data, i) => {
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.name = `lanternhold-timber-${['color', 'normal', 'roughness'][i]}`;
        texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    });
    const material = color => {
        const m = new THREE.MeshStandardMaterial({ color, normalMap: maps[1], roughnessMap: maps[2], roughness: 1 });
        // Opaque wood needs no color sampler in its depth pass. Three's shared
        // stock depth material can retain and re-upload a retired color map.
        // Keep this sampler in the color shader alone, with ordinary texture
        // ownership visible to RenderSystem.disposeObjectResources.
        m.lanternholdColorMap = maps[0];
        m.onBeforeCompile = shader => {
            shader.uniforms.lanternholdTimberColor = { value: m.lanternholdColorMap };
            shader.vertexShader = shader.vertexShader
                .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nvarying vec2 vLanternholdTimberUv;')
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLanternholdTimberUv = uv;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D lanternholdTimberColor;\nvarying vec2 vLanternholdTimberUv;')
                .replace('#include <map_fragment>', 'diffuseColor *= texture2D(lanternholdTimberColor, vLanternholdTimberUv);');
        };
        m.customProgramCacheKey = () => 'lanternhold-timber-color-v1';
        m.userData.lanternholdTimberSurface = true;
        return m;
    };
    // One scene-owned set shared by the lighter boards and dark structural
    // frame. Ordinary resource retirement deduplicates these three textures.
    return { timber: material(0xffffff), frame: material(0x71695e) };
}
