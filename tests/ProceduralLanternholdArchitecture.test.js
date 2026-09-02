import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    LANTERNHOLD_STRUCTURE_DEFINITIONS,
    LANTERNHOLD_STRUCTURE_IDS,
    createLanternholdCampPlacements,
    createProceduralLanternholdStructure,
    getProceduralLanternholdCacheMetrics
} from '../src/art/ProceduralLanternholdArchitecture.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

const REQUIRED_IDENTITY_PARTS = Object.freeze({
    oathhall: ['oathhall:bell-tower', 'oathhall:oath-bell', 'oathhall:belfry-spire'],
    trading_post: ['market:merchant-counter', 'market:ledger:-3.25', 'market:votive:lantern-flame'],
    blacksmith: ['smithy:chimney-stack', 'smithy:horned-stack-cap', 'smithy:sign-anvil'],
    camp: ['camp:grave-road-tent', 'camp:oathfire-ring', 'camp:split-oath-banner'],
    trading_house: ['compact:gilded-ledger-sign', 'compact:chained-scale-ring', 'compact:scale-pan:-1'],
    forge: ['forge:white-hot-mouth', 'forge:crowned-hood', 'forge:anvil-face'],
    stash: ['stash:black-oak-coffer', 'stash:oath-lock', 'stash:lock-rune']
});

function visibleMeshes(root) {
    const meshes = [];
    root.traverse((object) => {
        if (object.isMesh && object.userData.proceduralTownPart) meshes.push(object);
    });
    return meshes;
}

describe('procedural Lanternhold architecture', () => {
    test('covers every authored town-building role with an intentional style and exact gameplay bounds', () => {
        expect(LANTERNHOLD_STRUCTURE_IDS).toEqual([
            'oathhall',
            'trading_post',
            'blacksmith',
            'camp',
            'trading_house',
            'forge',
            'stash'
        ]);

        for (const structureId of LANTERNHOLD_STRUCTURE_IDS) {
            const definition = LANTERNHOLD_STRUCTURE_DEFINITIONS[structureId];
            const root = createProceduralLanternholdStructure(structureId);
            root.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(root);
            const size = bounds.getSize(new THREE.Vector3());
            const gameplayBounds = root.getObjectByName(`${structureId}:gameplay-bounds`);
            const parts = visibleMeshes(root);

            expect(root.userData).toEqual(expect.objectContaining({
                proceduralTownStructure: true,
                structureId,
                artStyle: definition.artStyle,
                role: definition.role,
                gameplayBounds: definition.bounds
            }));
            expect(definition.artStyle).toMatch(/^Lanternhold /);
            expect(gameplayBounds).toBeTruthy();
            expect(gameplayBounds.material.visible).toBe(false);
            expect(gameplayBounds.userData.gameplayBounds).toBe(true);
            expect(size.toArray()).toEqual(expect.arrayContaining(definition.bounds));
            definition.bounds.forEach((value, index) => expect(size.getComponent(index)).toBeCloseTo(value, 5));
            expect(bounds.min.y).toBeCloseTo(0, 5);
            expect(parts.length).toBeGreaterThanOrEqual(structureId === 'camp' ? 13 : 11);
            expect(parts.every((part) => part.geometry?.isBufferGeometry)).toBe(true);
            expect(parts.every((part) => part.material?.flatShading)).toBe(true);
            expect(parts.every((part) => [
                part.position.x, part.position.y, part.position.z,
                part.scale.x, part.scale.y, part.scale.z
            ].every(Number.isFinite))).toBe(true);

            const contractMin = new THREE.Vector3(-definition.bounds[0] / 2, 0, -definition.bounds[2] / 2);
            const contractMax = new THREE.Vector3(definition.bounds[0] / 2, definition.bounds[1], definition.bounds[2] / 2);
            for (const part of parts) {
                const partBounds = new THREE.Box3().setFromObject(part);
                expect(partBounds.min.x).toBeGreaterThanOrEqual(contractMin.x - 1e-6);
                expect(partBounds.min.y).toBeGreaterThanOrEqual(contractMin.y - 1e-6);
                expect(partBounds.min.z).toBeGreaterThanOrEqual(contractMin.z - 1e-6);
                expect(partBounds.max.x).toBeLessThanOrEqual(contractMax.x + 1e-6);
                expect(partBounds.max.y).toBeLessThanOrEqual(contractMax.y + 1e-6);
                expect(partBounds.max.z).toBeLessThanOrEqual(contractMax.z + 1e-6);
            }
        }
    });

    test('gives every structure semantic identity pieces instead of anonymous fallback boxes', () => {
        for (const [structureId, expectedNames] of Object.entries(REQUIRED_IDENTITY_PARTS)) {
            const root = createProceduralLanternholdStructure(structureId);
            const names = new Set(visibleMeshes(root).map((part) => part.name));
            expectedNames.forEach((name) => expect(names).toContain(name));
        }
    });

    test('shares immutable rendering resources while keeping each structure transform-owned', () => {
        const first = createProceduralLanternholdStructure('trading_house');
        const second = createProceduralLanternholdStructure('trading_house');
        const firstParts = new Map(visibleMeshes(first).map((part) => [part.name, part]));
        const secondParts = new Map(visibleMeshes(second).map((part) => [part.name, part]));

        expect(first).not.toBe(second);
        for (const [name, firstPart] of firstParts) {
            expect(secondParts.get(name).geometry).toBe(firstPart.geometry);
            expect(secondParts.get(name).material).toBe(firstPart.material);
            expect(secondParts.get(name)).not.toBe(firstPart);
        }
        first.position.set(20, 3, -5);
        expect(second.position.toArray()).toEqual([0, 0, 0]);
        expect(getProceduralLanternholdCacheMetrics()).toEqual({
            geometries: 10,
            materials: 15,
            structures: 7
        });
    });

    test('routes every interactive town object through generated geometry without invoking GLTFLoader', async () => {
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        try {
            const expected = {
                TradingHouse: 'trading_house',
                Forge: 'forge',
                Stash: 'stash'
            };
            for (const [type, structureId] of Object.entries(expected)) {
                const mesh = await MeshFactory.createMeshForType(type);
                expect(mesh.userData).toEqual(expect.objectContaining({
                    proceduralTownStructure: true,
                    structureId
                }));
            }
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            loadSpy.mockRestore();
        }
    });

    test('places all fifteen outer-town camps deterministically with the existing clearance contract', () => {
        const first = createLanternholdCampPlacements(0, 200);
        const second = createLanternholdCampPlacements(0, 200);

        expect(second).toEqual(first);
        expect(first).toHaveLength(15);
        for (const [index, placement] of first.entries()) {
            expect(Math.hypot(placement.x, placement.z - 200)).toBeGreaterThanOrEqual(50);
            expect(Number.isFinite(placement.rotation)).toBe(true);
            for (const other of first.slice(index + 1)) {
                expect(Math.hypot(placement.x - other.x, placement.z - other.z)).toBeGreaterThanOrEqual(20);
            }
        }
    });

    test('fails loudly for an unmapped structure family', () => {
        expect(() => createProceduralLanternholdStructure('generic-building'))
            .toThrow('Unknown Lanternhold structure: generic-building');
    });
});
