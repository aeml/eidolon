import * as THREE from 'three';
import { createWoodlandWindMaterial, WOODLAND_WIND_REACH } from '../src/art/WoodlandWindMaterial.js';
import { createWoodlandUnderstoryGeometry } from '../src/art/WoodlandUnderstoryGeometry.js';

test('wind uses shared render uniforms and responds to live reduced motion without listeners', () => {
    let seconds = 0;
    const preference = { matches: false };
    const material = createWoodlandWindMaterial({ now: () => seconds, motionPreference: preference });
    const shaders = [0, 1].map(() => ({ uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader }));
    for (const shader of shaders) material.onBeforeCompile(shader);
    expect(shaders[0].uniforms.woodlandTime).toBe(shaders[1].uniforms.woodlandTime);
    seconds = 12.5; material.onBeforeRender();
    expect(shaders[0].uniforms.woodlandTime.value).toBe(12.5);
    expect(shaders[0].uniforms.woodlandMotion.value).toBe(1);
    preference.matches = true; material.onBeforeRender();
    expect(shaders[0].uniforms.woodlandMotion.value).toBe(0);
    preference.matches = false; seconds = NaN; material.onBeforeRender();
    expect(shaders[0].uniforms.woodlandTime.value).toBe(0);
    expect(shaders[0].uniforms.woodlandMotion.value).toBe(1);
    expect(shaders[0].vertexShader).toContain('objectNormal.y -=');
    expect(shaders[0].vertexShader).toContain('transformed.xz += woodlandOffset * woodlandHeight * woodlandHeight');
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.map).toBeNull();
    material.dispose();
});

test.each(['bracken', 'sedge'])('%s wind stays in existing placement clearance with planted roots', kind => {
    const geometry = createWoodlandUnderstoryGeometry(kind), vertices = geometry.attributes.position;
    let maxRadius = 0, roots = 0;
    for (let i = 0; i < vertices.count; i++) {
        const y = vertices.getY(i), displacement = WOODLAND_WIND_REACH * y * y;
        if (y === 0) { roots++; expect(displacement).toBe(0); }
        // Triangle inequality covers every wind phase and orientation, not
        // only a few favorable sampled times.
        maxRadius = Math.max(maxRadius, (Math.hypot(vertices.getX(i), vertices.getZ(i)) + displacement) * 1.4);
        expect(y).toBeLessThan(1);
    }
    expect(roots).toBeGreaterThan(0);
    expect(maxRadius).toBeLessThan(2.2);
    geometry.dispose();
});
