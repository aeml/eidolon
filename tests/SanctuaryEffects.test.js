import * as THREE from 'three';
import { jest } from '@jest/globals';
import { LevelUpEffect } from '../src/ui/LevelUpEffect.js';
import { createCrossedGlowGeometry, createSanctuaryMaterial } from '../src/art/SanctuaryMaterials.js';

test.each(['star', 'seal'])('%s analytic light feathers its edges without external textures or shared mutable time', motif => {
    const mat = createSanctuaryMaterial(0xffcf68, { motif });
    const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader, uniforms: {} };
    mat.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('vSanctuaryUv * 2.0 - 1.0');
    expect(shader.vertexShader).toContain('vSanctuaryUv = uv;');
    expect(shader.fragmentShader).toContain('smoothstep');
    expect(shader.fragmentShader).toContain('#include <opaque_fragment>');
    expect(mat.map).toBeNull(); expect(mat.depthWrite).toBe(false);
    expect(mat.forceSinglePass).toBe(true); expect(mat.wireframe).toBe(false);
    expect(shader.uniforms).toEqual({}); mat.dispose();
});

test('crossed star geometry has UVs and stable bounds from all three view directions', () => {
    const geometry = createCrossedGlowGeometry();
    expect(geometry.attributes.position.count).toBe(18);
    expect(geometry.attributes.uv.count).toBe(18);
    for (let i = 0; i < 18; i++) {
        expect(geometry.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i))).toBe(true);
    }
    geometry.dispose();
});

test.each([['high', 96], ['low', 48]])('level-up %s quality uses four render objects and %s GPU-driven sparks', (quality, count) => {
    const scene = new THREE.Group(), position = new THREE.Vector3(10, 3, 20);
    const effect = new LevelUpEffect(scene, position, { quality });
    expect(effect.group.parent).toBe(scene); expect(effect.meshes).toHaveLength(4);
    expect(effect.particles.geometry.attributes.position.count).toBe(count);
    expect(effect.position).not.toBe(position); expect(effect.position.toArray()).toEqual(position.toArray());
    const sourcePositions = Array.from(effect.particles.geometry.attributes.position.array);
    effect.update(.7);
    expect(effect.particles.material.uniforms.uTime.value).toBe(.7);
    expect(Array.from(effect.particles.geometry.attributes.position.array)).toEqual(sourcePositions);
    for (const part of effect.meshes) { expect(part.material.depthWrite).toBe(false); expect(part.castShadow).toBe(false); }
    const resources = effect.meshes.flatMap(part => [part.geometry, part.material]);
    const disposals = resources.map(resource => jest.spyOn(resource, 'dispose'));
    effect.update(3); effect.dispose(); effect.update(1);
    expect(effect.isActive).toBe(false); expect(effect.group.parent).toBeNull(); expect(scene.children).toHaveLength(0);
    disposals.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});

test('moving local or remote owners retain their authoritative position while the celebration follows the visual mesh', () => {
    const owner = { position: new THREE.Vector3(3, 0, 5), mesh: new THREE.Group() };
    owner.mesh.position.set(3, 2, 5);
    const effect = new LevelUpEffect(new THREE.Group(), owner.position, { owner });
    owner.mesh.position.set(8, 4, 9); effect.update(.4);
    expect(effect.group.position.toArray()).toEqual([8, 4, 9]);
    expect(owner.position.toArray()).toEqual([3, 0, 5]);
    for (const dt of [-1, NaN, Infinity]) effect.update(dt);
    expect(effect.time).toBe(.4); effect.dispose();
});

test('spark sizing uses the current drawing buffer and accounts for orthographic versus perspective projection', () => {
    const effect = new LevelUpEffect(new THREE.Group(), new THREE.Vector3());
    const renderer = { getDrawingBufferSize: size => size.set(780, 1688) };
    effect.particles.onBeforeRender(renderer);
    expect(effect.particles.material.uniforms.uViewportHeight.value).toBe(1688);
    renderer.getDrawingBufferSize = size => size.set(1280, 900);
    effect.particles.onBeforeRender(renderer);
    expect(effect.particles.material.uniforms.uViewportHeight.value).toBe(900);
    expect(effect.particles.material.vertexShader).toContain('projectionMatrix[3][3] == 0.0');
    expect(effect.particles.material.vertexShader).toContain('uViewportHeight * projectionMatrix[1][1] / perspectiveDivisor');
    effect.dispose();
});

test('reduced-motion celebration avoids expanding waves and spinning beams; simultaneous effects do not share uniforms', () => {
    const scene = new THREE.Group(), position = new THREE.Vector3();
    const a = new LevelUpEffect(scene, position, { reducedMotion: true });
    const b = new LevelUpEffect(scene, position);
    a.update(.5); const scale = a.ring.scale.toArray(); a.update(.5);
    expect(a.ring.scale.toArray()).toEqual(scale); expect(a.seal.rotation.z).toBe(0);
    expect(a.pillar.material.uniforms.uTime.value).toBe(0); expect(a.particles.material.uniforms.uMotion.value).toBe(0);
    expect(b.particles.material.uniforms.uTime.value).toBe(0);
    expect(a.particles.material).not.toBe(b.particles.material); a.dispose(); b.dispose();
});
