import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { createProceduralStatusEffect, releaseProceduralStatusEffect,
    updateProceduralStatusEffect } from '../src/art/ProceduralStatusEffects.js';

const meshes = root => {
    const parts = [];
    root.traverse(part => { if (part.isMesh && part.visible) parts.push(part); });
    return parts;
};
const moteInstances = root => meshes(root).flatMap(part => {
    if (part.userData.motion === 'rest-rise-batch') {
        return part.userData.moteIndices.map((index, slot) => {
            const matrix = new THREE.Matrix4(), color = part.material.color.clone();
            part.getMatrixAt(slot, matrix);
            if (part.instanceColor) {
                const tint = new THREE.Color();
                part.getColorAt(slot, tint); color.multiply(tint);
            }
            return { index, matrix, color, opacity: part.material.opacity, part };
        });
    }
    if (part.userData.motion !== 'rest-rise') return [];
    part.updateMatrix();
    return [{ index: part.userData.phase * 16, matrix: part.matrix.clone(),
        color: part.material.color, opacity: part.material.opacity, part }];
}).sort((a, b) => a.index - b.index);

test.each([['high', 5, 16], ['low', 4, 8]])('%s aura preserves detail with %s render meshes', (quality, budget, count) => {
    const root = createProceduralStatusEffect('well_rested', { quality });
    updateProceduralStatusEffect(root, .37, .37);
    expect(moteInstances(root)).toHaveLength(count);
    expect(meshes(root)).toHaveLength(budget);
    expect(meshes(root).filter(part => part.isInstancedMesh)).toHaveLength(2);
    releaseProceduralStatusEffect(root);
});

test.each(['high', 'low'])('%s motes retain every authored orbit, fade and elemental color', quality => {
    const root = createProceduralStatusEffect('well_rested', { quality });
    for (const elapsed of [0, .37, 1.8, 5.0, 17.3, 1000.1]) {
        updateProceduralStatusEffect(root, elapsed, .1);
        const actual = moteInstances(root);
        expect(actual.map(mote => mote.index)).toEqual(Array.from({ length: 16 }, (_, i) => i)
            .filter(i => quality === 'high' || i % 2 === 0));
        for (const mote of actual) {
            const phase = mote.index / 16, angle = phase * Math.PI * 8 + elapsed * .45;
            const radius = .85 + (mote.index % 3) * .2;
            const rise = (elapsed * .2 + phase) % 1, fade = Math.sin(rise * Math.PI);
            const expected = new THREE.Object3D();
            expected.position.set(Math.cos(angle) * radius, .15 + rise * 2.6, Math.sin(angle) * radius);
            expected.rotation.y = angle;
            expected.scale.set(.18 * fade, .32 * fade, .18 * fade); expected.updateMatrix();
            mote.matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.matrix.elements[i], 5));
            const colors = [0x93d58b, 0xc8efff, 0xff985c, 0x72caff];
            const colored = mote.index % 4 === 0;
            const color = new THREE.Color(colored ? colors[mote.index / 4] : 0xffcf68);
            mote.color.toArray().forEach((value, i) => expect(value).toBeCloseTo(color.toArray()[i], 5));
            expect(mote.opacity).toBe(colored ? .72 : .86);
            expect(mote.part.material.transparent).toBe(true);
            expect(mote.part.material.depthWrite).toBe(false);
            expect(mote.part.castShadow).toBe(false);
            if (mote.part.isInstancedMesh) {
                const vertices = mote.part.geometry.attributes.position;
                for (let i = 0; i < vertices.count; i++) {
                    const vertex = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mote.matrix);
                    expect(mote.part.boundingSphere.containsPoint(vertex)).toBe(true);
                }
            }
        }
    }
    releaseProceduralStatusEffect(root);
});

test('actors share immutable shape/materials, never instance matrices, and release owned GPU buffers once', () => {
    const first = createProceduralStatusEffect('well_rested'), second = createProceduralStatusEffect('well_rested');
    const a = meshes(first).filter(part => part.isInstancedMesh), b = meshes(second).filter(part => part.isInstancedMesh);
    expect(a).toHaveLength(2); expect(b).toHaveLength(2);
    for (let i = 0; i < a.length; i++) {
        expect(a[i].geometry).toBe(b[i].geometry);
        expect(a[i].material).toBe(b[i].material);
        expect(a[i].instanceMatrix).not.toBe(b[i].instanceMatrix);
        expect(a[i].instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    }
    updateProceduralStatusEffect(second, 1, 1);
    const unchanged = Array.from(b[0].instanceMatrix.array);
    updateProceduralStatusEffect(first, 4, 4);
    expect(Array.from(b[0].instanceMatrix.array)).toEqual(unchanged);
    const disposed = a.map(part => { const spy = jest.fn(); part.addEventListener('dispose', spy); return spy; });
    const disposeGeometry = jest.spyOn(a[0].geometry, 'dispose');
    const disposeMaterial = jest.spyOn(a[0].material, 'dispose');
    releaseProceduralStatusEffect(first); releaseProceduralStatusEffect(first);
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(disposeGeometry).not.toHaveBeenCalled(); expect(disposeMaterial).not.toHaveBeenCalled();
    expect(b[0].parent).toBe(second);
    disposeGeometry.mockRestore(); disposeMaterial.mockRestore();
    releaseProceduralStatusEffect(second);
});

test.each(['high', 'low'])('%s actor scene/quality/lifecycle churn releases only retired instance buffers', quality => {
    const originalScene = new THREE.Group(), nextScene = new THREE.Group();
    const makeActor = id => {
        const actor = new Fighter(id);
        actor.mesh = new THREE.Group();
        actor.wellRestedSeconds = 30;
        actor.gameEngine = { renderSystem: { effectGroup: originalScene, graphicsQuality: quality } };
        actor.syncAttachedStatusEffects(.1);
        return actor;
    };
    const actor = makeActor('moving-rested-owner'), neighbor = makeActor('unaffected-rested-owner');
    const neighborEffect = neighbor.attachedStatusEffects.get('well_rested');
    const neighborBatches = meshes(neighborEffect.group).filter(part => part.isInstancedMesh);
    const unchangedNeighbor = neighborBatches.map(part => Array.from(part.instanceMatrix.array));
    const sharedDisposals = [...new Set(neighborBatches.flatMap(part => [part.geometry, part.material]))]
        .map(resource => jest.spyOn(resource, 'dispose'));
    const observed = new Map();
    const record = () => {
        const effect = actor.attachedStatusEffects.get('well_rested');
        if (effect && !observed.has(effect)) {
            const parts = meshes(effect.group).filter(part => part.isInstancedMesh);
            expect(parts).toHaveLength(2);
            observed.set(effect, parts.map(part => {
                const disposed = jest.fn(); part.addEventListener('dispose', disposed); return disposed;
            }));
        }
        return effect;
    };
    const verify = () => {
        const current = record(), scene = actor.gameEngine.renderSystem.effectGroup;
        const visible = actor.state !== 'DEAD' && actor.isActive !== false &&
            actor.stealthTimer <= 0 && actor.wellRestedSeconds > 0;
        expect(Boolean(current)).toBe(visible);
        if (current) {
            expect(current.group.parent).toBe(scene);
            expect(moteInstances(current.group)).toHaveLength(actor.gameEngine.renderSystem.graphicsQuality === 'low' ? 8 : 16);
            expect(current.group.position.toArray()).toEqual(actor.mesh.position.toArray());
        }
        for (const [effect, disposed] of observed) {
            disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(effect === current ? 0 : 1));
            if (effect !== current) expect(effect.group.parent).toBeNull();
        }
        expect(neighbor.attachedStatusEffects.get('well_rested')).toBe(neighborEffect);
        expect(neighborEffect.group.parent).toBe(originalScene);
        neighborBatches.forEach((part, index) => expect(Array.from(part.instanceMatrix.array)).toEqual(unchangedNeighbor[index]));
        sharedDisposals.forEach(spy => expect(spy).not.toHaveBeenCalled());
        for (const candidate of [originalScene, nextScene]) {
            expect(candidate.children.filter(child => child.name === `AttachedStatusEffect:well_rested:${actor.id}`))
                .toHaveLength(current && candidate === scene ? 1 : 0);
        }
    };
    try {
        actor.stealthTimer = 0;
        record(); verify();
        for (let cycle = 0; cycle < 3; cycle++) {
            for (const graphicsQuality of ['low', 'high']) {
                actor.gameEngine.renderSystem.graphicsQuality = graphicsQuality;
                actor.syncAttachedStatusEffects(.1); verify();
            }
            for (const effectGroup of [nextScene, originalScene]) {
                actor.gameEngine.renderSystem.effectGroup = effectGroup;
                actor.mesh.position.set(cycle * 5, 2, -10);
                actor.syncAttachedStatusEffects(.1); verify();
            }
            for (const [field, hidden, restored] of [['stealthTimer', 2, 0], ['state', 'DEAD', 'IDLE'],
                ['isActive', false, true], ['wellRestedSeconds', 0, 30]]) {
                actor[field] = hidden; actor.syncAttachedStatusEffects(.1); verify();
                actor[field] = restored; actor.syncAttachedStatusEffects(.1); verify();
            }
            expect(actor.wellRestedSeconds).toBe(30);
        }
    } finally {
        actor.dispose(); neighbor.dispose();
        sharedDisposals.forEach(spy => spy.mockRestore());
    }
    for (const disposed of observed.values()) disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(originalScene.children).toHaveLength(0);
    expect(nextScene.children).toHaveLength(0);
});
