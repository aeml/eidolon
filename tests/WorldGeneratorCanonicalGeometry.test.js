import * as THREE from 'three';
import { jest } from '@jest/globals';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

function createGenerator() {
    const scene = { add: jest.fn() };
    const collisionManager = {
        addCollider: jest.fn(),
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

        expect(generator.preloadTextures).toHaveBeenCalledTimes(1);
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
        const entranceScene = new THREE.Group();
        entranceScene.add(new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial()
        ));
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel').mockResolvedValue({
            scene: entranceScene,
            animations: []
        });

        try {
            await expect(generator.createOverworldStructures({
                shouldAttach: () => false
            })).resolves.toBe(false);
            expect(loadModelSpy).toHaveBeenCalledTimes(1);
            expect(generator.scene.add).not.toHaveBeenCalled();
            expect(generator.collisionManager.addCircularCollider).not.toHaveBeenCalled();
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

        expect(generator.createCorridor.mock.calls).toEqual([
            [40, 0, 100, 0, 20, 0, 0],
            [100, 0, 100, 60, 20, 0, 0]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [100, 0, 20, { west: true, south: true }]
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
            { north: true }
        ]);
    });

    test('uses canonical boss approaches that leave a non-zero final segment into large rooms', async () => {
        const generator = createGenerator();

        await generator[methodName](0, 0, buildLargeBossApproachLayout());

        expect(generator.createCorridor.mock.calls).toEqual([
            [0, -50, 0, -70, 40, 0, 0],
            [0, -70, 80, -70, 40, 0, 0],
            [80, -70, 80, -90, 40, 0, 0]
        ]);

        expect(generator.createCorner.mock.calls).toEqual([
            [0, -70, 40, { south: true, east: true }],
            [80, -70, 40, { west: true, north: true }]
        ]);

        const finalSegment = generator.createCorridor.mock.calls[2];
        expect(Math.abs(finalSegment[3] - finalSegment[1])).toBeGreaterThan(0);

        expect(generator.createRoom.mock.calls[0]).toEqual([
            0,
            0,
            100,
            0x111111,
            { north: true }
        ]);
        expect(generator.createRoom.mock.calls[1]).toEqual([
            80,
            -180,
            180,
            0x222222,
            { south: true }
        ]);
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

    test('configures instanced foliage materials for alpha-cutout silhouettes', async () => {
        const generator = createGenerator();
        const foliageMaterial = new THREE.MeshStandardMaterial({
            map: { isTexture: true },
            transparent: true,
            side: THREE.DoubleSide
        });
        const leafMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), foliageMaterial);
        const scene = new THREE.Group();
        scene.add(leafMesh);
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel').mockResolvedValue({ scene, animations: [] });

        await generator.loadTrees(0, 200);

        const addedTreeGroup = generator.scene.add.mock.calls.find(([obj]) => obj?.name?.startsWith('trees:'))?.[0];
        expect(addedTreeGroup).toBeTruthy();
        const instancedMesh = addedTreeGroup.children[0];
        const material = Array.isArray(instancedMesh.material) ? instancedMesh.material[0] : instancedMesh.material;
        expect(instancedMesh.castShadow).toBe(true);
        expect(instancedMesh.receiveShadow).toBe(true);
        expect(material.transparent).toBe(false);
        expect(material.alphaTest).toBeGreaterThanOrEqual(0.5);
        expect(material.shadowSide).toBe(THREE.DoubleSide);
        expect(material.forceSinglePass).toBe(true);
        expect(material.alphaToCoverage).toBe(false);

        loadModelSpy.mockRestore();
    });

    test('configures building meshes with stable front-sided shadows to avoid bleed through walls', async () => {
        const generator = createGenerator();
        const buildingScene = new THREE.Group();
        buildingScene.add(new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        ));
        const loadModelSpy = jest.spyOn(MeshFactory, 'loadModel').mockResolvedValue({ scene: buildingScene, animations: [] });

        await generator.loadBuildings(0, 0);

        const addedBuilding = generator.scene.add.mock.calls[0][0];
        const mesh = addedBuilding.children.find(child => child.isMesh);
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
