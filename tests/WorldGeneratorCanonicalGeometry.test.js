import * as THREE from 'three';
import { jest } from '@jest/globals';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { PROCEDURAL_FOLIAGE_RECIPES } from '../src/art/ProceduralRealmFoliage.js';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';
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
    test('canonical gameplay floors use the broader24-unit scale continuously across room and corridor partitions', async () => {
        const generator = createGenerator();
        const layout = buildCanonicalLayout();
        await generator.createAbyssalWell(0, 0, layout);
        const floors = generator.scene.add.mock.calls.map(([mesh]) => mesh)
            .filter(mesh => mesh.name === 'DungeonUnionFloor');
        expect(floors.length).toBeGreaterThan(1);
        expect(new Set(floors.map(floor => floor.material)).size).toBe(1);
        for (const floor of floors) {
            expect(floor.material.map.repeat.toArray()).toEqual([1, 1]);
            expect(floor.material.emissiveMap.repeat.toArray()).toEqual([1, 1]);
            const vertices = floor.geometry.getAttribute('position');
            const uv = floor.geometry.getAttribute('uv');
            for (let index = 0; index < uv.count; index++) {
                expect(uv.getX(index)).toBeCloseTo((vertices.getX(index) + floor.position.x - layout.rooms[0].x) / 24, 5);
                expect(uv.getY(index)).toBeCloseTo((vertices.getY(index) - floor.position.z + layout.rooms[0].z) / 24, 5);
            }
        }
        verifyCanonicalSurfaces(generator, layout);
    });

    test('a legacy dungeon preload cannot attach floors after its scene is superseded', async () => {
        const generator = createGenerator();
        let finishPreload;
        let current = true;
        generator.preloadTextures = jest.fn(() => new Promise(resolve => { finishPreload = resolve; }));
        const pending = generator.createDungeon(0, 0, 100, { shouldAttach: () => current });
        current = false;
        finishPreload();
        await pending;
        expect(generator.scene.add).not.toHaveBeenCalled();
        expect(generator.collisionManager.addCollider).not.toHaveBeenCalled();
    });

    test('a town invalidated between base and decorations does not attach stale services', async () => {
        const generator = createGenerator();
        let finishBase;
        let current = true;
        generator.createTownBase = jest.fn(() => new Promise(resolve => { finishBase = resolve; }));
        generator.createTownDecorations = jest.fn();
        const pending = generator.createTown(0, 200, 100, { shouldAttach: () => current });
        current = false;
        finishBase();
        await pending;
        expect(generator.createTownDecorations).not.toHaveBeenCalled();
    });

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
        expect(generator.loadBuildings).toHaveBeenCalledWith(10, 20, {});
        expect(generator.loadTrees).toHaveBeenCalledWith(10, 20, {});
    });

    test('a superseded decoration load attaches no path surfaces or foliage', async () => {
        const generator = createGenerator();
        generator.loadBuildings = jest.fn(); generator.loadTrees = jest.fn();
        await generator.createTownDecorations(0, 200, { shouldAttach: () => false });
        expect(generator.scene.add).not.toHaveBeenCalled();
        expect(generator.loadBuildings).not.toHaveBeenCalled();
        expect(generator.loadTrees).not.toHaveBeenCalled();
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
                    if (mesh.material.userData.dungeonVeilTime) {
                        // The recessed aperture is double-sided, not offset masonry.
                        expect(mesh.userData.portalSurface).toBe(true);
                        expect(mesh.material.side).toBe(THREE.DoubleSide);
                        expect(mesh.material.transparent).toBe(false);
                        expect(mesh.material.depthWrite).toBe(true);
                        expect(mesh.material.customProgramCacheKey()).toBe('dungeon-veil-v1');
                    } else {
                        expect(mesh.material.polygonOffset).toBe(true);
                        expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
                    }
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
            expect(mesh.material.polygonOffset).toBe(false);
        }
    });

    test.each(['high', 'low'])('builds deterministic instanced procedural foliage without authored model loads (%s)', async quality => {
        const generator = createGenerator();
        generator.graphicsQuality = quality;
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel');

        await generator.loadTrees(0, 200);

        const groups = generator.scene.add.mock.calls.map(([object]) => object).filter(object => object.userData.proceduralFoliage);
        expect(groups).toHaveLength(PROCEDURAL_FOLIAGE_RECIPES.length);
        expect(generator.scene.add.mock.calls.filter(([object]) => object.userData.earthUnderstory)).toHaveLength(1);
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
            expect(group.children.length).toBeGreaterThanOrEqual(getFoliageRenderBatches(recipe.id, quality).length);
            for (const instance of group.children) {
                expect(instance).toBeInstanceOf(THREE.InstancedMesh);
                expect(instance.count).toBe(instance.userData.placementIndices.length);
                expect(instance.count).toBeLessThanOrEqual(recipe.count);
                // Bark intentionally uses smooth normals; material identity
                // against the authored batch is verified below for every part.
                expect(instance.material.transparent).toBe(false);
                expect(instance.material.depthWrite).toBe(true);
                expect([THREE.FrontSide, THREE.DoubleSide]).toContain(instance.material.side);
            }
            const parts = getFoliageRenderBatches(recipe.id, quality);
            for (const part of parts) {
                const batches = group.children.filter(instance => instance.name === part.name);
                const indices = batches.flatMap(batch => batch.userData.placementIndices);
                expect(indices.toSorted((a, b) => a - b)).toEqual(Array.from({ length: recipe.count }, (_, i) => i));
                for (const batch of batches) {
                    expect(batch.geometry).toBe(part.geometry);
                    expect(batch.material).toBe(part.material);
                    batch.userData.placementIndices.forEach((placementIndex, instanceIndex) => {
                        const placement = group.userData.placements[placementIndex];
                        // Compact Earth cells retain the exact tree identity,
                        // not a lower-detail crown or a missing instance.
                        const cellSize = recipe.region === 'earth' ? 8 : recipe.renderCellSize;
                        expect(batch.userData.foliageCell).toBe(`${Math.floor(placement.x / cellSize)},${Math.floor(placement.z / cellSize)}`);
                        const expected = new THREE.Matrix4().compose(new THREE.Vector3(placement.x, 0, placement.z),
                            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation),
                            new THREE.Vector3().setScalar(placement.scale)).multiply(part.matrix);
                        const actual = new THREE.Matrix4(); batch.getMatrixAt(instanceIndex, actual);
                        expected.elements.forEach((value, i) => expect(actual.elements[i]).toBeCloseTo(value, 3));
                    });
                }
            }
            if (recipe.renderCellSize) {
                expect(recipe.renderCellSize).toBeLessThanOrEqual(64);
                expect(new Set(group.children.map(mesh => mesh.userData.foliageCell)).size).toBeGreaterThan(1);
                expect(Math.max(...group.children.map(mesh => mesh.count))).toBeLessThan(recipe.count / 3);
                for (const mesh of group.children) {
                    // Tighter spheres need to contain real crowns, not empty
                    // corners of the aggregate box. Independently transform
                    // every vertex, including crowns beyond placement edges.
                    const box = mesh.boundingBox, sphere = mesh.boundingSphere;
                    const position = mesh.geometry.attributes.position, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
                    let maxDistance = 0, maxBoxEscape = 0;
                    for (let index = 0; index < mesh.count; index++) {
                        mesh.getMatrixAt(index, matrix);
                        for (let vertex = 0; vertex < position.count; vertex++) {
                            point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
                            maxDistance = Math.max(maxDistance, sphere.center.distanceTo(point));
                            maxBoxEscape = Math.max(maxBoxEscape, box.distanceToPoint(point));
                        }
                    }
                    expect(maxDistance).toBeGreaterThan(0);
                    if (maxDistance > sphere.radius + 1e-6) {
                        throw new Error(`${recipe.id}/${mesh.name}: actual crown radius ${maxDistance} exceeds ${sphere.radius}`);
                    }
                    expect(maxDistance).toBeLessThanOrEqual(sphere.radius + 1e-6);
                    expect(maxBoxEscape).toBeLessThanOrEqual(1e-6);
                }
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
        expect(generator.scene.add).toHaveBeenCalledTimes(9);
        const [paths, locations] = generator.scene.add.mock.calls.slice(0, 2).map(([object]) => object);
        expect(paths.name).toBe('Earth authored paths');
        expect(locations.name).toBe('Earth authored locations');
        expect(locations.children).toHaveLength(8);
        const cart = generator.scene.add.mock.calls[1][1];
        expect(cart.name).toBe('Lanternhold stranded supply cart');
        expect(cart.userData.walkFootprints).toHaveLength(3);
        // The shared-zone entrance retains a closed physical door. Smithy
        // walls now use an oriented footprint rather than the roof's AABB.
        const earthSolids = locations.userData.walkFootprints.length;
        expect(earthSolids).toBe(27);
        const elemental = generator.scene.add.mock.calls[2];
        expect(elemental.map(group => group.name)).toEqual(['water authored locations', 'fire authored locations', 'air authored locations', 'Water authored paths', 'Fire authored paths', 'Air authored paths']);
        expect(elemental.slice(0, 3).map(group => group.children.length)).toEqual([8, 8, 9]);
        // Air still has exactly eight locations. Its ninth child is the
        // existing non-solid passage cover, not a new authoritative site.
        expect(elemental[2].children.filter(child => child.name.startsWith('air-location:'))).toHaveLength(8);
        const passage = elemental[2].getObjectByName('Air passage heath and scree');
        expect(passage.children).toHaveLength(86);
        expect(passage.children.every(mesh => mesh.userData.airPassageGroundCover && !mesh.castShadow && mesh.receiveShadow)).toBe(true);
        const worldSolids = earthSolids + cart.userData.walkFootprints.length
            + elemental.slice(0, 3).reduce((sum, group) => sum + group.userData.walkFootprints.length, 0);
        expect(worldSolids).toBe(129);
        const streets = generator.scene.add.mock.calls[7][0];
        expect(streets.name).toBe('Lanternhold planted street edges');
        expect(streets.userData.walkFootprints).toHaveLength(4);
        expect(generator.collisionManager.addCollider).toHaveBeenCalledTimes(22 + worldSolids + 13 + 4);
        const doorCollider = generator.collisionManager.addCollider.mock.calls[worldSolids][0];
        expect(doorCollider.getCenter(new THREE.Vector3()).toArray()).toEqual([0, 2.4, -21.65]);
        expect(doorCollider.getSize(new THREE.Vector3()).toArray()).toEqual([5, 4.8, 0.5]);
        expect(doorCollider.containsPoint(new THREE.Vector3(0, 1, -21.65))).toBe(true);
        expect(doorCollider.containsPoint(new THREE.Vector3(0, 1, -19))).toBe(false);
        expect(generator.collisionManager.addOrientedCollider).toHaveBeenCalledTimes(1);
        const smithy = generator.collisionManager.addOrientedCollider.mock.calls[0][0];
        expect(smithy.box.getSize(new THREE.Vector3()).toArray()).toEqual([11.8, 32, 10.2]);
        expect(new THREE.Vector3().setFromMatrixPosition(smithy.matrix).toArray()).toEqual([-30, -0.5, 0]);
        const structures = generator.scene.add.mock.calls.slice(3).map(([object]) => object);
        expect(structures.slice(0, 3).map((structure) => structure.userData.structureId)).toEqual([
            'casino',
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
        )).toBeLessThanOrEqual(48);

        const mesh = structures[0].children.find(child => child.isMesh && child.material.visible !== false);
        expect(mesh).toBeTruthy();
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.material.shadowSide).toBe(THREE.FrontSide);
        expect(mesh.material.polygonOffset).toBe(false);

        loadModelSpy.mockRestore();
    });
});
