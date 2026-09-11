import * as THREE from 'three';
import { runInNewContext } from 'node:vm';
import { expandedRestAura } from './expandedRestAura.js';
import { createProceduralStatusEffect, updateProceduralStatusEffect,
    releaseProceduralStatusEffect } from '../src/art/ProceduralStatusEffects.js';

test.each([['high', 19], ['low', 10]])('%s GPU reference preserves visible geometry, transforms and tint', (quality, visibleCount) => {
    const build = runInNewContext(`(${expandedRestAura.toString()})`);
    const batch = createProceduralStatusEffect('well_rested', { quality });
    batch.position.set(-4, 0, 2); batch.rotation.y = .2; batch.scale.setScalar(1.2);
    const cache = new Map();
    try {
        for (const time of [.37, 1.8, 4.2]) {
            updateProceduralStatusEffect(batch, time, .1);
            const reference = build(THREE, batch, cache);
            expect(reference.children.filter(part => part.visible)).toHaveLength(visibleCount);
            expect(reference.position.equals(batch.position)).toBe(true);
            expect(reference.quaternion.equals(batch.quaternion)).toBe(true);
            expect(reference.scale.equals(batch.scale)).toBe(true);
            expect(reference.children.some(part => part.isInstancedMesh)).toBe(false);
            let index = 0;
            for (const part of batch.children) {
                if (!part.isInstancedMesh) {
                    const copy = reference.children[index++];
                    expect(copy.geometry).toBe(part.geometry); expect(copy.material).toBe(part.material);
                    expect(copy.visible).toBe(part.visible); continue;
                }
                for (let slot = 0; slot < part.count; slot++) {
                    const copy = reference.children[index++], matrix = new THREE.Matrix4();
                    part.getMatrixAt(slot, matrix);
                    expect(copy.matrix.equals(matrix)).toBe(true);
                    const color = part.material.color.clone();
                    if (part.instanceColor) { const tint = new THREE.Color(); part.getColorAt(slot, tint); color.multiply(tint); }
                    expect(copy.material.color.equals(color)).toBe(true);
                    expect(copy.material.opacity).toBe(part.material.opacity);
                    expect(copy.geometry).toBe(part.geometry);
                }
            }
            reference.clear();
        }
        expect(cache.size).toBe(4);
    } finally {
        releaseProceduralStatusEffect(batch); cache.forEach(material => material.dispose());
    }
});

test('multiple reference actors reuse tint materials without mutating either source', () => {
    const a = createProceduralStatusEffect('well_rested'), b = createProceduralStatusEffect('well_rested');
    const cache = new Map(), colorBefore = a.children.filter(part => part.isInstancedMesh).map(part => part.material.color.clone());
    const first = expandedRestAura(THREE, a, cache), second = expandedRestAura(THREE, b, cache);
    expect(cache.size).toBe(4);
    first.children.forEach((part, index) => expect(part.material).toBe(second.children[index].material));
    a.children.filter(part => part.isInstancedMesh).forEach((part, index) => expect(part.material.color.equals(colorBefore[index])).toBe(true));
    expect(a.children.length).toBeGreaterThan(0); expect(b.children.length).toBeGreaterThan(0);
    first.clear(); second.clear(); releaseProceduralStatusEffect(a); releaseProceduralStatusEffect(b);
    cache.forEach(material => material.dispose());
});
