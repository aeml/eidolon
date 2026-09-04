import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    DUNGEON_INTERIOR_DEFINITIONS,
    DUNGEON_INTERIOR_IDS,
    DUNGEON_ROOM_IDENTITY_IDS,
    animateDungeonRoomStatePresentation,
    applyDungeonRoomStatePresentation,
    createProceduralDungeonInteriorKit
} from '../src/art/ProceduralDungeonInteriors.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

const identityRooms = Object.freeze({
    entry_gate: { type: 'start' },
    treasure_cache: { type: 'normal', hook: 'chest' },
    restorative_shrine: { type: 'normal', hook: 'shrine' },
    ambush_chamber: { type: 'elite', hook: 'elite_ambush' },
    boss_approach: { type: 'normal', pacing: 'boss_approach' },
    elite_guard: { type: 'elite' },
    boss_lair: { type: 'boss' },
    route_hall: { type: 'normal' }
});

function finiteObject(object) {
    const bounds = new THREE.Box3().setFromObject(object);
    return [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite);
}

describe('Procedural dungeon interior art', () => {
    test('defines five distinct interior languages and five distinct generated surface maps', () => {
        expect(DUNGEON_INTERIOR_IDS).toHaveLength(5);
        expect(new Set(DUNGEON_INTERIOR_IDS.map((id) => DUNGEON_INTERIOR_DEFINITIONS[id].artStyle)).size).toBe(5);
        expect(new Set(DUNGEON_INTERIOR_IDS.map((id) => DUNGEON_INTERIOR_DEFINITIONS[id].surfaceLanguage)).size).toBe(5);

        const surfaceSignatures = DUNGEON_INTERIOR_IDS.map((dungeonType) => {
            const kit = createProceduralDungeonInteriorKit(dungeonType);
            const material = kit.floorMaterial(120, 120);
            expect(material.map).toBeInstanceOf(THREE.DataTexture);
            expect(material.emissiveMap).toBeInstanceOf(THREE.DataTexture);
            expect(material.userData).toEqual(expect.objectContaining({
                proceduralDungeonSurface: true,
                dungeonType,
                surface: 'floor'
            }));
            return Array.from(material.map.image.data).join(',');
        });

        expect(new Set(surfaceSignatures).size).toBe(DUNGEON_INTERIOR_IDS.length);
    });

    test.each(DUNGEON_INTERIOR_IDS)('%s renders every authoritative room identity as finite visual-only dressing', (dungeonType) => {
        const kit = createProceduralDungeonInteriorKit(dungeonType);
        DUNGEON_ROOM_IDENTITY_IDS.forEach((identity, roomIndex) => {
            const room = { x: roomIndex * 180, z: 20000, width: 120, height: 120, ...identityRooms[identity] };
            const dressing = kit.createRoomDressing(room, roomIndex, { optimized: false });
            expect(dressing.userData).toEqual(expect.objectContaining({
                proceduralDungeonInterior: true,
                dungeonType,
                roomIndex,
                roomIdentity: identity,
                visualOnly: true,
                roomBounds: [120, 120]
            }));
            expect(finiteObject(dressing)).toBe(true);
            expect(dressing.children.filter((child) => child.isMesh).length).toBeGreaterThanOrEqual(6);
            dressing.traverse((child) => {
                if (!child.isMesh) return;
                expect(child.userData.proceduralDungeonInteriorPart).toBe(true);
            });
        });
    });

    test('reuses surface resources within an instance and batches semantic room detail for production', () => {
        const kit = createProceduralDungeonInteriorKit('molten_core');
        const floorA = kit.floorMaterial(140, 140);
        const floorB = kit.floorMaterial(140, 140);
        const wallA = kit.wallMaterial(142, 15, false);
        const wallB = kit.wallMaterial(142, 15, false);
        const geometryA = kit.floorGeometry(140, 140);
        const geometryB = kit.floorGeometry(140, 140);
        const room = { x: 30000, z: 20000, width: 140, height: 140, type: 'boss' };
        const dressing = kit.createRoomDressing(room, 1, { optimized: true });

        expect(floorA).toBe(floorB);
        expect(wallA).toBe(wallB);
        expect(geometryA).toBe(geometryB);
        expect(dressing.userData.renderBatched).toBe(true);
        expect(dressing.userData.sourceMeshCount).toBeGreaterThan(dressing.userData.drawMeshCount);
        expect(dressing.userData.drawMeshCount).toBeLessThanOrEqual(8);
        expect(finiteObject(dressing)).toBe(true);
        expect(kit.metrics()).toEqual({
            surfaceTextures: 4,
            surfaceMaterials: 2,
            surfaceGeometries: 1,
            detailGeometries: 8,
            detailMaterials: 5
        });
    });

    test.each(DUNGEON_INTERIOR_IDS)('%s room dressing mirrors objective, reward, cleared, and exit lifecycle', (dungeonType) => {
        const kit = createProceduralDungeonInteriorKit(dungeonType);
        const rewardRoom = { x: 100, z: 0, width: 120, height: 120, type: 'normal', hook: 'chest' };
        const rewardDressing = kit.createRoomDressing(rewardRoom, 1, { optimized: true });
        const rewardState = rewardDressing.getObjectByName(`DungeonRoomState:${dungeonType}:1`);

        applyDungeonRoomStatePresentation(rewardState, { index: 1, cleared: false }, {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1
        });
        expect(rewardState.getObjectByName('DungeonObjectiveHalo').visible).toBe(true);
        expect(rewardState.getObjectByName('DungeonObjectiveCrown').visible).toBe(true);
        expect(rewardState.getObjectByName('DungeonRewardSeal').visible).toBe(true);

        applyDungeonRoomStatePresentation(rewardState, { index: 1, cleared: true }, {
            currentRoomIndex: 1,
            objectiveRoomIndex: 2
        });
        expect(rewardState.getObjectByName('DungeonObjectiveHalo').visible).toBe(false);
        expect(rewardState.getObjectByName('DungeonClearedSigil').visible).toBe(true);
        expect(rewardState.getObjectByName('DungeonRewardSeal').visible).toBe(false);
        const clearedOpacity = rewardState.getObjectByName('DungeonClearedSigil').material.opacity;
        animateDungeonRoomStatePresentation(rewardState, 0.8);
        expect(rewardState.getObjectByName('DungeonClearedSigil').material.opacity).not.toBe(clearedOpacity);

        const entryDressing = kit.createRoomDressing({ x: 0, z: 0, width: 120, height: 120, type: 'start' }, 0, { optimized: true });
        const entryState = entryDressing.getObjectByName(`DungeonRoomState:${dungeonType}:0`);
        applyDungeonRoomStatePresentation(entryState, { index: 0, cleared: false }, {
            currentRoomIndex: 0,
            objectiveRoomIndex: -1
        });
        expect(entryState.getObjectByName('DungeonExitPortal').material.opacity).toBe(0.9);
        expect(entryState.userData.exitReady).toBe(true);
    });

    test.each([
        ['createVerdantBastionCatacombs', 'verdant_bastion_catacombs'],
        ['createMoltenCore', 'molten_core'],
        ['createTempestSpire', 'tempest_spire'],
        ['createAbyssalWell', 'abyssal_well']
    ])('%s builds exact canonical surfaces without loading authored cobblestone textures', async (methodName, dungeonType) => {
        const scene = new THREE.Group();
        const collisionManager = { addCollider: jest.fn() };
        const generator = new WorldGenerator(scene, collisionManager);
        const preloadSpy = jest.spyOn(generator, 'preloadTextures');
        const layout = {
            rooms: [
                { x: 20000, z: 20000, width: 120, height: 120, type: 'start', color: 0x123456 }
            ],
            walkRects: [
                { x: 20000, z: 20000, width: 120, height: 120, kind: 'room', roomIndex: 0 }
            ],
            corridors: []
        };

        await generator[methodName](0, 0, layout);

        expect(preloadSpy).not.toHaveBeenCalled();
        const floor = scene.getObjectByName('ProceduralDungeonRoomFloor');
        const dressing = scene.children.find((child) => child.userData?.proceduralDungeonInterior);
        expect(floor).toBeTruthy();
        expect(floor.userData.dungeonType).toBe(dungeonType);
        expect(floor.material.map).toBeInstanceOf(THREE.DataTexture);
        expect(floor.geometry.parameters).toEqual(expect.objectContaining({ width: 120, height: 120 }));
        expect(dressing.userData.roomIdentity).toBe('entry_gate');
        expect(collisionManager.addCollider).toHaveBeenCalledTimes(4);

        const colliderSizes = collisionManager.addCollider.mock.calls.map(([box]) => box.getSize(new THREE.Vector3()));
        expect(colliderSizes).toEqual(expect.arrayContaining([
            expect.objectContaining({ x: 122, y: 15, z: 2 }),
            expect.objectContaining({ x: 2, y: 15, z: 122 })
        ]));
    });

    test('world generator drives room-state art from authoritative dungeon summaries', async () => {
        const scene = new THREE.Group();
        const collisionManager = { addCollider: jest.fn() };
        const generator = new WorldGenerator(scene, collisionManager);
        const layout = {
            rooms: [
                { x: 20000, z: 20000, width: 120, height: 120, type: 'start' },
                { x: 20000, z: 19820, width: 100, height: 100, type: 'normal', hook: 'shrine' }
            ],
            walkRects: [
                { x: 20000, z: 20000, width: 120, height: 120, kind: 'room', roomIndex: 0 },
                { x: 20000, z: 19910, width: 40, height: 100, kind: 'corridor' },
                { x: 20000, z: 19820, width: 100, height: 100, kind: 'room', roomIndex: 1 }
            ],
            corridors: [{ fromRoomIndex: 0, toRoomIndex: 1, width: 40, walkRectIndices: [1] }]
        };

        await generator.createVerdantBastionCatacombs(0, 0, layout);
        generator.updateDungeonRoomState({
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', cleared: false },
                { index: 1, type: 'normal', hook: 'shrine', cleared: false }
            ]
        });

        const objectiveState = generator.dungeonRoomPresentations.get(1);
        expect(objectiveState.userData.objective).toBe(true);
        expect(objectiveState.getObjectByName('DungeonRewardSeal').visible).toBe(true);
        generator.updateDungeonPresentation(0.5);
        expect(generator.dungeonPresentationElapsed).toBeCloseTo(0.5, 5);
    });
});
