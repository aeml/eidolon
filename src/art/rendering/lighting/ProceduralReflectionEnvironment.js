import * as THREE from 'three';

/**
 * A quiet, broad sky bounce for metal and leather. Direct lights alone leave
 * metal's unlit facets black. This small, renderer-owned radiance map supplies
 * reflected light without extra shadow lights, downloads or per-frame work.
 * Regional direct lighting still provides the scene's color and mood.
 */
export function createProceduralReflectionEnvironment() {
    const width = 128;
    const height = 64;
    const pixels = new Float32Array(width * height * 4);
    const key = new THREE.Vector3(-0.6, 0.75, 0.28).normalize();
    const rim = new THREE.Vector3(0.65, 0.35, -0.68).normalize();
    for (let y = 0; y < height; y++) {
        const latitude = ((y + 0.5) / height - 0.5) * Math.PI;
        const up = Math.sin(latitude);
        const horizon = Math.cos(latitude);
        const sky = Math.pow((up + 1) * 0.5, 0.65);
        for (let x = 0; x < width; x++) {
            const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
            const dx = Math.cos(longitude) * horizon;
            const dz = Math.sin(longitude) * horizon;
            const warm = Math.pow(Math.max(0, dx * key.x + up * key.y + dz * key.z), 8) * 1.4;
            const cool = Math.pow(Math.max(0, dx * rim.x + up * rim.y + dz * rim.z), 6) * 0.65;
            const offset = (y * width + x) * 4;
            pixels[offset] = 0.07 + sky * 0.32 + warm + cool * 0.72;
            pixels[offset + 1] = 0.065 + sky * 0.36 + warm * 0.92 + cool * 0.86;
            pixels[offset + 2] = 0.06 + sky * 0.43 + warm * 0.8 + cool;
            pixels[offset + 3] = 1;
        }
    }
    const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.name = 'Eidolon_SoftSkyReflection';
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}
