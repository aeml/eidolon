import * as THREE from 'three';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS,
    createProceduralDungeonEntrance,
    getProceduralDungeonEntranceCacheMetrics
} from '../src/art/ProceduralDungeonEntrances.js';

const EXPECTED_CONTRACTS = Object.freeze({
    verdant_bastion_catacombs: {
        bounds: [76.13120079040527, 61.46895885467529, 72.87123918533325],
        position: [800, 0, 200],
        semanticParts: ['verdant:witch-gate:eidolic-veil', 'verdant:antler-trunk:-1', 'verdant:funerary-sun']
    },
    molten_core: {
        bounds: [76.23759984970093, 71.23167991638184, 75.87180137634277],
        position: [-2400, 0, 200],
        semanticParts: ['molten:furnace-mouth:eidolic-veil', 'molten:great-chain-upper:-1', 'molten:threshold-rift']
    },
    tempest_spire: {
        bounds: [44.4045615196228, 76.54812097549438, 48.13672065734863],
        position: [2400, 0, 200],
        semanticParts: ['tempest:storm-eye:eidolic-veil', 'tempest:floating-slate:-1:0', 'tempest:lightning-leg-a:1']
    },
    abyssal_well: {
        bounds: [76.47827863693237, 37.49948024749756, 52.10767984390259],
        position: [0, 0, -1400],
        semanticParts: ['abyssal:black-water-eye', 'abyssal:reliquary-gate:eidolic-veil', 'abyssal:anchor-tentacle-front:1']
    }
});

describe('procedural dungeon entrances', () => {
    test('catalogs every production threshold with its measured legacy contract', () => {
        expect(DUNGEON_ENTRANCE_IDS).toEqual(Object.keys(EXPECTED_CONTRACTS));
        for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
            const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
            const expected = EXPECTED_CONTRACTS[dungeonType];
            expect(definition.bounds).toEqual(expected.bounds);
            expect(definition.position).toEqual(expected.position);
            expect(definition.interactionRadius).toBeCloseTo(
                Math.min(expected.bounds[0], expected.bounds[2]) * 0.45,
                10
            );
            expect(definition.artStyle).toMatch(/Thorncrypt|Furnace Below|Shattered Aerie|Drowned Sanctum/);
        }
    });

    test.each(DUNGEON_ENTRANCE_IDS)('%s owns intentional themed parts and an exact grounded gameplay box', (dungeonType) => {
        const entrance = createProceduralDungeonEntrance(dungeonType, { optimized: false });
        const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
        const expected = EXPECTED_CONTRACTS[dungeonType];
        const gameplayBounds = entrance.getObjectByName(`${dungeonType}:gameplay-bounds`);

        expect(entrance.name).toBe('DungeonEntrance');
        expect(entrance.userData).toEqual(expect.objectContaining({
            dungeonType,
            artStyle: definition.artStyle,
            proceduralDungeonEntrance: true,
            gameplayBounds: expected.bounds,
            interactionRadius: definition.interactionRadius
        }));
        expect(gameplayBounds).toBeInstanceOf(THREE.Mesh);
        expect(gameplayBounds.position.y).toBeCloseTo(expected.bounds[1] / 2, 10);
        expect(gameplayBounds.scale.toArray()).toEqual(expected.bounds);
        expect(gameplayBounds.material.visible).toBe(false);
        for (const name of expected.semanticParts) expect(entrance.getObjectByName(name)).toBeTruthy();

        entrance.updateMatrixWorld(true);
        const actual = new THREE.Box3().setFromObject(entrance);
        const actualSize = actual.getSize(new THREE.Vector3()).toArray();
        expected.bounds.forEach((value, index) => expect(actualSize[index]).toBeCloseTo(value, 5));
        expect(actual.min.y).toBeCloseTo(0, 5);
        const visibleParts = [];
        entrance.traverse((part) => {
            if (part.isMesh && part.userData.proceduralDungeonEntrancePart) visibleParts.push(part);
        });
        expect(visibleParts.length).toBeGreaterThanOrEqual(24);
        expect(visibleParts.some((part) => part.userData.portalSurface)).toBe(true);
        expect(visibleParts.every((part) => [
            ...part.position.toArray(),
            part.rotation.x, part.rotation.y, part.rotation.z,
            ...part.scale.toArray()
        ].every(Number.isFinite))).toBe(true);
    });

    test('batches each production entrance by regional material without sharing mutable roots', () => {
        const firstRoots = [];
        for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
            const first = createProceduralDungeonEntrance(dungeonType);
            const second = createProceduralDungeonEntrance(dungeonType);
            firstRoots.push(first);
            expect(first).not.toBe(second);
            expect(first.userData.renderBatched).toBe(true);
            expect(first.userData.sourceMeshCount).toBeGreaterThanOrEqual(24);
            expect(first.userData.drawMeshCount).toBeLessThanOrEqual(9);
            expect(first.children.filter((part) => part.userData.proceduralDungeonEntrancePart)).toHaveLength(
                first.userData.drawMeshCount
            );
            expect(first.children[0].geometry).toBe(second.children[0].geometry);
            expect(first.children[0].material).toBe(second.children[0].material);
            first.position.x = 99;
            expect(second.position.x).toBe(0);
        }
        expect(new Set(firstRoots.map((root) => root.userData.artStyle)).size).toBe(4);
        expect(getProceduralDungeonEntranceCacheMetrics()).toEqual({
            geometries: 11,
            materials: 25,
            entrances: 4
        });
    });

    test('rejects unknown entrance routes instead of hiding coverage behind a fallback', () => {
        expect(() => createProceduralDungeonEntrance('unmapped_void')).toThrow(
            'Unknown procedural dungeon entrance: unmapped_void'
        );
    });
});
