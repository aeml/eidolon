import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    CRYSTAL_SANCTUM_DEFINITIONS,
    createProceduralCrystalSanctum,
    disposeCrystalSanctum
} from '../src/art/ProceduralCrystalSanctums.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { decorateDungeonRoomState } from '../src/utils/dungeonRoomMetadata.js';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';

const raids = Object.keys(CRYSTAL_SANCTUM_DEFINITIONS);
const snapshotFor = (raidType, stage = 'fractured', progress = 0) => ({
    instanceId: 'raid-current', raidType, element: CRYSTAL_SANCTUM_DEFINITIONS[raidType].element,
    name: CRYSTAL_SANCTUM_DEFINITIONS[raidType].name, stage, progress, wave: stage === 'restored' ? 3 : 1,
    totalWaves: 3, x: 80000, z: 19280
});
const generatorFor = raidType => {
    const scene = new THREE.Group();
    const collision = { addCollider: jest.fn(), addCircularCollider: jest.fn() };
    const generator = new WorldGenerator(scene, collision, {
        instanceId: 'raid-current', instanceType: raidType,
        layout: { rooms: [{ x: 80000, z: 19280, type: 'boss', width: 270, height: 250 }] }
    });
    return { generator, scene, collision };
};

test.each(raids)('%s has finite, non-targetable crystal art and genuinely joined restored facets', raidType => {
    const root = createProceduralCrystalSanctum(raidType);
    expect(root.userData.motif).toBe(CRYSTAL_SANCTUM_DEFINITIONS[raidType].motif);
    for (const stage of ['fractured', 'repairing', 'restored']) {
        root.applySnapshot(snapshotFor(raidType, stage, 66));
        root.animate(7.5, 'high');
        root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(root);
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
        expect(bounds.max.y).toBeLessThan(24);
        expect(bounds.min.z).toBeGreaterThan(-50);
        expect(bounds.max.z).toBeLessThan(1);
        const hits = [];
        root.traverse(object => {
            if (object.isMesh) object.raycast(new THREE.Raycaster(), hits);
        });
        expect(hits).toEqual([]);
        expect(root.getObjectByName('MaelinRitualThread').visible).toBe(stage === 'repairing');
        const facets = root.getObjectByName('ThreeCrystalFacets').children;
        if (stage === 'restored') {
            for (const facet of facets) {
                expect(facet.position.length()).toBe(0);
                expect(Math.abs(facet.rotation.z)).toBe(0);
            }
        } else {
            expect(facets[0].position.length()).toBeGreaterThan(0);
        }
    }
    disposeCrystalSanctum(root);
});

test.each(raids)('%s lowers visible detail dynamically without duplicating a crystal or adding collisions', raidType => {
    const { generator, scene, collision } = generatorFor(raidType);
    for (const [stage, progress] of [['fractured', 0], ['repairing', 33], ['repairing', 66], ['restored', 100]]) {
        generator.updateDungeonRoomState({ rooms: [], crystal: snapshotFor(raidType, stage, progress) });
    }
    expect(scene.children).toHaveLength(1);
    expect(collision.addCollider).not.toHaveBeenCalled();
    expect(collision.addCircularCollider).not.toHaveBeenCalled();
    const crystal = generator.crystalSanctum;
    expect(crystal.position.toArray()).toEqual([80000, 0, 19280]);
    generator.updateDungeonPresentation(0.2, 'low');
    expect(crystal.getObjectByName('CrystalResonanceMotes').count).toBe(6);
    expect(crystal.getObjectByName('FineResonanceFiligree').visible).toBe(false);
    generator.updateDungeonPresentation(0.2, 'high');
    expect(crystal.getObjectByName('CrystalResonanceMotes').count).toBe(12);
    expect(crystal.getObjectByName('FineResonanceFiligree').visible).toBe(true);
    expect(scene.children).toHaveLength(1);
    disposeCrystalSanctum(crystal);
});

test('uses only a matching authoritative snapshot, never boss completion or a stale raid event', () => {
    const { generator, scene } = generatorFor(raids[0]);
    generator.updateDungeonRoomState({ rooms: [{ type: 'boss', cleared: true }] });
    expect(scene.children).toHaveLength(0);
    const valid = snapshotFor(raids[0]);
    for (const override of [{ instanceId: 'old-instance' }, { raidType: raids[1] }, { element: 'Water' }, { x: NaN }, { z: 5 }, { stage: 'complete' }]) {
        generator.updateDungeonRoomState({ crystal: { ...valid, ...override } });
        expect(scene.children).toHaveLength(0);
    }
    generator.updateDungeonRoomState({ crystal: valid });
    const crystal = generator.crystalSanctum;
    generator.updateDungeonRoomState({ crystal: { ...valid, stage: 'restored', instanceId: 'old-instance' } });
    expect(crystal.userData.stage).toBe('fractured');
    generator.updateDungeonRoomState(null);
    expect(crystal.visible).toBe(false);
    generator.updateDungeonRoomState({ crystal: { ...valid, stage: 'restored', progress: 100 } });
    expect(crystal.visible).toBe(true);
    expect(scene.children).toHaveLength(1);
    expect(crystal.userData.stage).toBe('restored');
    disposeCrystalSanctum(crystal);
});

test('actual room-state message handler drives real art without a crystal callout or local quest', () => {
    class Harness {}
    installGameEngineNetworkMessages(Harness);
    const { generator } = generatorFor(raids[0]);
    const engine = new Harness();
    engine.player = { id: 'ordinary-raider' };
    engine.activeWorldGenerator = generator;
    engine.buildDungeonBeatAdvanceCallout = () => null;
    engine.refreshDungeonEntranceHint = () => {};
    const crystal = snapshotFor(raids[0], 'restored', 100);
    const payload = decorateDungeonRoomState({ rooms: [], crystal });
    engine.handleServerMessage({ type: 'dungeon_room_state', payload });
    expect(generator.crystalSanctum.userData.stage).toBe('restored');
    expect(engine.currentDungeonRoomState.crystal).toEqual(crystal);
    disposeCrystalSanctum(generator.crystalSanctum);
});

test.each(raids)('%s owns and disposes its GPU resources exactly once', raidType => {
    const root = createProceduralCrystalSanctum(raidType);
    const scene = new THREE.Group();
    scene.add(root);
    const resources = new Set();
    root.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        if (object.material) resources.add(object.material);
    });
    const disposed = [...resources].map(resource => jest.spyOn(resource, 'dispose'));
    disposeCrystalSanctum(root);
    expect(scene.children).toHaveLength(0);
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});

test('each realm uses its own silhouette and material instances', () => {
    const roots = raids.map(createProceduralCrystalSanctum);
    expect(new Set(roots.map(root => root.userData.motif)).size).toBe(4);
    const signatures = roots.map(root => {
        const parts = [];
        root.traverse(object => { if (object.isMesh) parts.push(object.name); });
        return parts.join('|');
    });
    expect(new Set(signatures).size).toBe(4);
    const first = roots[0].getObjectByName('CrystalFacet:1').material;
    const second = roots[1].getObjectByName('CrystalFacet:1').material;
    expect(first).not.toBe(second);
    roots[0].applySnapshot({ stage: 'restored' });
    expect(first.color.equals(second.color)).toBe(false);
    roots.forEach(disposeCrystalSanctum);
});

test('crystal Vigil dressing replaces only decorative boss glare with a thin non-emissive inlay', () => {
    const kit = createProceduralDungeonInteriorKit('molten_core');
    const room = { x: 0, z: 0, width: 270, height: 250, type: 'boss' };
    const normal = kit.createRoomDressing(room, 0, { optimized: false });
    const vigil = kit.createRoomDressing({ ...room, hook: 'crystal_vigil' }, 0, { optimized: false });
    expect(normal.getObjectByName('boss:soul-circuit')).toBeDefined();
    expect(vigil.getObjectByName('boss:soul-circuit')).toBeUndefined();
    const inlay = vigil.getObjectByName('boss:crystal-vigil-inlay');
    expect(inlay.geometry.parameters.innerRadius / inlay.geometry.parameters.outerRadius).toBeGreaterThan(0.97);
    expect(inlay.material.emissiveIntensity).toBe(0);
    expect(vigil.getObjectByName('DungeonObjectiveHalo')).toBeDefined();
    expect(vigil.getObjectByName('DungeonClearedSigil')).toBeDefined();
});
