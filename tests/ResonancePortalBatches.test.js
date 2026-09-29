import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createResonancePortalModel } from '../src/art/ResonancePortalModel.js';

function surfaces(root) {
    root.updateMatrixWorld(true);
    const rows = [], p = new THREE.Vector3(), n = new THREE.Vector3();
    root.traverse(part => {
        if (!part.isMesh) return;
        const g = part.geometry, normal = new THREE.Matrix3().getNormalMatrix(part.matrixWorld);
        const signature = [part.material.type, part.material.color?.getHex(), part.material.roughness,
            part.material.metalness, part.castShadow, part.receiveShadow, part.visible].join(':');
        for (let i = 0; i < (g.index?.count ?? g.attributes.position.count); i++) {
            const index = g.index ? g.index.getX(i) : i;
            p.fromBufferAttribute(g.attributes.position, index).applyMatrix4(part.matrixWorld);
            n.fromBufferAttribute(g.attributes.normal, index).applyNormalMatrix(normal);
            const values = [...p, ...n, g.attributes.uv.getX(index), g.attributes.uv.getY(index)];
            rows.push(signature + ':' + values.map(v => (Math.round(v * 1000) || 0).toString()).join(','));
        }
    });
    return rows.sort();
}

test('static plaza batches preserve surfaces, UVs, shadow policy and walk solids', () => {
    const original = createResonancePortalModel({ batched: false }), batched = createResonancePortalModel();
    expect(batched.walls).toEqual(original.walls);
    expect(batched.mesh.children.filter(p => p.isMesh)).toHaveLength(12);
    expect(original.mesh.children.filter(p => p.isMesh)).toHaveLength(24);
    expect(surfaces(batched.mesh)).toEqual(surfaces(original.mesh));
    const batches = batched.mesh.children.filter(p => p.name.startsWith('PortalFrameBatch'));
    expect(batches).toHaveLength(2);
    for (const part of batches) {
        expect(part.geometry.boundingBox.isEmpty()).toBe(false);
        expect(part.geometry.attributes.normal.count).toBe(part.geometry.attributes.position.count);
    }
    original.dispose(); batched.dispose();
});

test('repair state, reduced motion and independent crystal effects survive batching', () => {
    const a = createResonancePortalModel(), b = createResonancePortalModel();
    a.update(.1, { eligible: false, stage: 'repairing', restored: [true, false, true, false], legacy: false }, true);
    expect(a.crystals.map(c => c.ray.visible)).toEqual([true, false, true, false]);
    expect(b.crystals.map(c => c.ray.visible)).toEqual([false, false, false, false]);
    expect(a.crystals.map(c => c.surface.emissiveIntensity)).toEqual([.65, .04, .65, .04]);
    a.update(.1, { eligible: true, stage: 'ready', restored: [], legacy: true }, true);
    expect(a.crystals.every(c => c.ray.visible && c.shard.parent === a.mesh)).toBe(true);
    const veil = a.mesh.children.find(p => p.material?.isShaderMaterial);
    expect(veil.material.uniforms.strength.value).toBe(.95);
    expect(veil.material.uniforms.time.value).toBe(0);
    a.dispose(); b.dispose();
});

test('the model owns and releases its final merged geometry once', () => {
    const model = createResonancePortalModel(), resources = new Set();
    model.mesh.traverse(p => { if (p.isMesh) { resources.add(p.geometry); resources.add(p.material); } });
    const spies = [...resources].map(resource => jest.spyOn(resource, 'dispose'));
    model.dispose();
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});
