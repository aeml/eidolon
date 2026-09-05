import * as THREE from 'three';
import { jest } from '@jest/globals';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { PROCEDURAL_FOLIAGE_RECIPES } from '../src/art/ProceduralRealmFoliage.js';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS
} from '../src/art/ProceduralDungeonEntrances.js';

function createGenerator() {
    const scene = { add: jest.fn() };
    const collisionManager = {
        addCollider: jest.fn(),
        addOrientedCollider: jest.fn(),
        addCircularCollider: jest.fn()
    };
    const generator = new WorldGenerator(scene, collisionManager);
    generator.preloadTextures = jest.fn().mockResolvedValue();
    generator.createRoom = jest.fn();
    generator.createCorridor = jest.fn();
    generator.createCorner = jest.fn();
    return generator;
}

function buildCanonicalLayout() {
    return {
        rooms: [
            { x: 0, z: 0, width: 80, color: 0x111111, type: 'start' },
            { x: 100, z: 100, width: 80, color: 0x222222, type: 'boss' }
        ],
        walkRects: [
            { x: 0, z: 0, width: 80, height: 80, kind: 'room', roomIndex: 0 },
            { x: 100, z: 100, width: 80, height: 80, kind: 'room', roomIndex: 1 },
            { x: 57.5, z: 0, width: 85, height: 20, kind: 'corridor' },
            { x: 100, z: 45, width: 20, height: 90, kind: 'corridor' }
        ],
        corridors: [
            {
                fromRoomIndex: 0,
                toRoomIndex: 1,
                width: 20,
                walkRectIndices: [2, 3]
            }
        ]
    };
}

function verifyCanonicalSurfaces(generator, layout) {
    expect(generator.createRoom).not.toHaveBeenCalled();
    expect(generator.createCorridor).not.toHaveBeenCalled();
    expect(generator.createCorner).not.toHaveBeenCalled();
    const floors = generator.scene.add.mock.calls.map(([mesh]) => mesh).filter(mesh => mesh.name === 'DungeonUnionFloor');
    expect(floors.length).toBeGreaterThan(0);
    const xs = [...new Set(layout.walkRects.flatMap(r => [r.x - r.width / 2, r.x + r.width / 2]))].sort((a, b) => a - b);
    const zs = [...new Set(layout.walkRects.flatMap(r => [r.z - r.height / 2, r.z + r.height / 2]))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
        const x = (xs[i - 1] + xs[i]) / 2;
        const z = (zs[j - 1] + zs[j]) / 2;
        const walkable = layout.walkRects.some(r => Math.abs(x - r.x) < r.width / 2 && Math.abs(z - r.z) < r.height / 2);
        const coveringFloors = floors.filter(mesh => {
            const r = mesh.userData.walkSurface;
            return x > r.left && x < r.right && z > r.top && z < r.bottom;
        });
        expect(coveringFloors).toHaveLength(walkable ? 1 : 0);
        if (walkable) {
            const point = new THREE.Vector3(x, 1, z);
            expect(generator.collisionManager.addCollider.mock.calls.some(([box]) => box.containsPoint(point))).toBe(false);
        }
    }
}

function buildLargeBossApproachLayout() {
    return {
        rooms: [
            { x: 0, z: 0, width: 100, height: 100, color: 0x111111, type: 'start' },
            { x: 80, z: -180, width: 180, height: 180, color: 0x222222, type: 'boss' }
        ],
        walkRects: [
            { x: 0, z: 0, width: 100, height: 100, kind: 'room', roomIndex: 0 },
            { x: 80, z: -180, width: 180, height: 180, kind: 'room', roomIndex: 1 },
            { x: 0, z: -60, width: 40, height: 60, kind: 'corridor' },
            { x: 40, z: -70, width: 120, height: 40, kind: 'corridor' },
            { x: 80, z: -80, width: 40, height: 60, kind: 'corridor' }
        ],
        corridors: [
            {
                fromRoomIndex: 0,
                toRoomIndex: 1,
                width: 40,
                walkRectIndices: [2, 3, 4]
            }
        ]
    };
}

describe('WorldGenerator staged overworld startup', () => {
    test('keeps the town base independently loadable and preserves full createTown behavior', async () => {
        const generator = createGenerator();
        generator.createRectangularFence = jest.fn();
        generator.loadBuildings = jest.fn().mockResolvedValue();
        generator.loadTrees = jest.fn().mockResolvedValue();

        await generator.createTownBase(0, 200, 100);

        expect(generator.preloadTextures).not.toHaveBeenCalled();
        expect(generator.createRectangularFence).toHaveBeenCalledWith(0, 200, 200, 200);
        expect(generator.loadBuildings).not.toHaveBeenCalled();
        expect(generator.loadTrees).not.toHaveBeenCalled();

        await generator.createTown(10, 20, 30);

        expect(generator.createRectangularFence).toHaveBeenLastCalledWith(10, 20, 60, 60);
        expect(generator.loadBuildings).toHaveBeenCalledWith(10, 20);
        expect(generator.loadTrees).toHaveBeenCalledWith(10, 20);
    });

    test('does not attach a deferred dungeon entrance after its overworld scene is invalidated', async () => {
        const generator = createGenerator();
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel');

        try {
            await expect(generator.createOverworldStructures({
                shouldAttach: () => false
            })).resolves.toBe(false);
            expect(loadModelSpy).not.toHaveBeenCalled();
            expect(generator.scene.add).not.toHaveBeenCalled();
            expect(generator.collisionManager.addCircularCollider).not.toHaveBeenCalled();
        } finally {
            loadModelSpy.mockRestore();
        }
    });

    test('attaches all four procedural thresholds with exact positions, IDs, radii, and no model load', async () => {
        const generator = createGenerator();
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel');

        try {
            await expect(generator.createOverworldStructures()).resolves.toBe(true);
            expect(loadModelSpy).not.toHaveBeenCalled();
            expect(generator.scene.add).toHaveBeenCalledTimes(DUNGEON_ENTRANCE_IDS.length);
            expect(generator.collisionManager.addCircularCollider).toHaveBeenCalledTimes(DUNGEON_ENTRANCE_IDS.length);

            DUNGEON_ENTRANCE_IDS.forEach((dungeonType, index) => {
                const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
                const entrance = generator.scene.add.mock.calls[index][0];
                expect(entrance.name).toBe('DungeonEntrance');
                expect(entrance.position.toArray()).toEqual(definition.position);
                expect(entrance.userData).toEqual(expect.objectContaining({
                    dungeonType,
                    proceduralDungeonEntrance: true,
                    interactionRadius: definition.interactionRadius,
                    renderBatched: true
                }));
                expect(generator.collisionManager.addCircularCollider).toHaveBeenNthCalledWith(
                    index + 1,
                    definition.position[0],
                    definition.position[2],
                    definition.interactionRadius
                );
                const visibleMeshes = entrance.children.filter((part) => (
                    part.isMesh && part.userData.proceduralDungeonEntrancePart
                ));
                expect(visibleMeshes).toHaveLength(entrance.userData.drawMeshCount);
                expect(visibleMeshes.length).toBeLessThanOrEqual(9);
                for (const mesh of visibleMeshes) {
                    expect(mesh.castShadow || mesh.userData.portalSurface).toBe(true);
                    expect(mesh.material.polygonOffset).toBe(true);
                    expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
                }
            });
        } finally {
            loadModelSpy.mockRestore();
        }
    });
});

describe.each([
    ['createVerdantBastionCatacombs'],
    ['createMoltenCore'],
    ['createTempestSpire'],
    ['createAbyssalWell']
])('%s', (methodName) => {
    test('uses canonical corridor walk rects and corridor attachments when present', async () => {
        const generator = createGenerator();

        await generator[methodName](0, 0, buildCanonicalLayout());

        verifyCanonicalSurfaces(generator, buildCanonicalLayout());
    });

    test('uses canonical boss approaches that leave a non-zero final segment into large rooms', async () => {
        const generator = createGenerator();

        await generator[methodName](0, 0, buildLargeBossApproachLayout());

        verifyCanonicalSurfaces(generator, buildLargeBossApproachLayout());
    });

    test('falls back to legacy room-order routing when canonical geometry is absent', async () => {
        const generator = createGenerator();
        const layout = {
            rooms: [
                { x: 0, z: 0, width: 80, color: 0x111111, type: 'start' },
                { x: 100, z: 100, width: 80, color: 0x222222, type: 'boss' }
            ]
        };

        await generator[methodName](0, 0, layout);

        expect(generator.createCorridor.mock.calls).toEqual([
            [0, 0, 50, 0, 40, 40, 20],
            [50, 0, 50, 100, 40, 20, 20],
            [50, 100, 100, 100, 40, 20, 40]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [50, 0, 40, { west: true, south: true }],
            [50, 100, 40, { north: true, east: true }]
        ]);

        expect(generator.createRoom.mock.calls[0]).toEqual([
            0,
            0,
            80,
            0x111111,
            { east: true }
        ]);
        expect(generator.createRoom.mock.calls[1]).toEqual([
            100,
            100,
            80,
            0x222222,
            { west: true }
        ]);
    });
});

describe('WorldGenerator shadow setup', () => {
    test('creates fence pieces with stable shadow-casting settings', () => {
        const generator = createGenerator();

        generator.createRectangularFence(0, 0, 24, 24);

        expect(generator.scene.add).toHaveBeenCalledTimes(1);
        const group = generator.scene.add.mock.calls[0][0];
        const meshes = group.children.filter(child => child.isMesh);
        expect(meshes.length).toBeGreaterThan(0);
        for (const mesh of meshes) {
            expect(mesh.castShadow).toBe(true);
            expect(mesh.receiveShadow).toBe(true);
            expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
            expect(mesh.material.polygonOffset).toBe(true);
        }
    });

    test('builds deterministic instanced procedural foliage without authored model loads', async () => {
        const generator = createGenerator();
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel');

        await generator.loadTrees(0, 200);

        const groups = generator.scene.add.mock.calls.map(([object]) => object);
        expect(groups).toHaveLength(PROCEDURAL_FOLIAGE_RECIPES.length);
        expect(loadModelSpy).not.toHaveBeenCalled();
        for (const [index, group] of groups.entries()) {
            const recipe = PROCEDURAL_FOLIAGE_RECIPES[index];
            expect(group.name).toBe(`foliage:${recipe.region}:${recipe.id}`);
            expect(group.userData).toEqual(expect.objectContaining({
                proceduralFoliage: true,
                foliageId: recipe.id,
                region: recipe.region,
                instanceCount: recipe.count
            }));
            expect(group.children.length).toBeGreaterThanOrEqual(4);
            for (const instance of group.children) {
                expect(instance).toBeInstanceOf(THREE.InstancedMesh);
                expect(instance.count).toBe(recipe.count);
                expect(instance.material.flatShading).toBe(true);
                expect(instance.material.transparent).toBe(false);
                expect(instance.material.depthWrite).toBe(true);
                expect([THREE.FrontSide, THREE.DoubleSide]).toContain(instance.material.side);
            }
        }

        const expectedColliders = PROCEDURAL_FOLIAGE_RECIPES
            .filter((recipe) => recipe.collision)
            .reduce((sum, recipe) => sum + recipe.count, 0);
        expect(generator.collisionManager.addCollider).toHaveBeenCalledTimes(expectedColliders);

        loadModelSpy.mockRestore();
    });

    test('does not leave invisible foliage colliders when its scene generation is stale', async () => {
        const generator = createGenerator();

        await expect(generator.loadTrees(0, 200, { shouldAttach: () => false })).resolves.toBe(false);

        expect(generator.scene.add).not.toHaveBeenCalled();
        expect(generator.collisionManager.addCollider).not.toHaveBeenCalled();
    });

    test('builds deterministic procedural town architecture with stable front-sided shadows', async () => {
        const generator = createGenerator();
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel');

        await generator.loadBuildings(0, 0);

        expect(loadModelSpy).not.toHaveBeenCalled();
        expect(generator.scene.add).toHaveBeenCalledTimes(4);
        expect(generator.collisionManager.addCollider).toHaveBeenCalledTimes(17);
        expect(generator.collisionManager.addOrientedCollider).toHaveBeenCalledTimes(1);
        const structures = generator.scene.add.mock.calls.map(([object]) => object);
        expect(structures.slice(0, 3).map((structure) => structure.userData.structureId)).toEqual([
            'oathhall',
            'trading_post',
            'blacksmith'
        ]);
        expect(structures[3].userData).toEqual(expect.objectContaining({
            proceduralTownCampField: true,
            instanceCount: 15,
            sourceMeshCount: 195,
            drawMeshCount: 9
        }));
        expect(structures.slice(0, 3).reduce(
            (total, structure) => total + structure.userData.drawMeshCount,
            structures[3].userData.drawMeshCount
        )).toBe(38);

        const mesh = structures[0].children.find(child => child.isMesh && child.material.visible !== false);
        expect(mesh).toBeTruthy();
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
        expect(mesh.material.polygonOffset).toBe(true);
        expect(mesh.material.polygonOffsetFactor).toBe(1);
        expect(mesh.material.polygonOffsetUnits).toBe(1);

        loadModelSpy.mockRestore();
    });
});
