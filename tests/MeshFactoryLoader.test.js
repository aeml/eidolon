import * as THREE from 'three';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { MeshCatalog } from '../src/utils/MeshCatalog.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { jest } from '@jest/globals';

describe('MeshFactory.loadModel', () => {
    const originalCache = MeshFactory.cache;
    const originalInflight = MeshFactory.inflight;

    beforeEach(() => {
        MeshFactory.cache = {};
        MeshFactory.inflight = {};
    });

    afterAll(() => {
        MeshFactory.cache = originalCache;
        MeshFactory.inflight = originalInflight;
    });

    test('deduplicates concurrent GLB requests via inflight cache', async () => {
        const fakeGltf = { scene: { name: 'scene' }, animations: [] };
        const loadSpy = jest.spyOn(GLTFLoader.prototype, 'load').mockImplementation((path, onLoad) => {
            setTimeout(() => onLoad(fakeGltf), 0);
        });

        const [resultA, resultB] = await Promise.all([
            MeshFactory.loadModel('./assets/test.glb'),
            MeshFactory.loadModel('./assets/test.glb')
        ]);

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(resultA).toBe(fakeGltf);
        expect(resultB).toBe(fakeGltf);

        loadSpy.mockRestore();
    });

    test('returns cached GLB on later requests without reloading', async () => {
        const fakeGltf = { scene: { name: 'cached' }, animations: [] };
        const loadSpy = jest.spyOn(GLTFLoader.prototype, 'load').mockImplementation((path, onLoad) => {
            setTimeout(() => onLoad(fakeGltf), 0);
        });

        const first = await MeshFactory.loadModel('./assets/cached.glb');
        const second = await MeshFactory.loadModel('./assets/cached.glb');

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(first).toBe(fakeGltf);
        expect(second).toBe(fakeGltf);

        loadSpy.mockRestore();
    });

    test('clears inflight entry after non-retriable error so next call can retry', async () => {
        const expectedError = new Error('404 not found');
        const fakeGltf = { scene: { name: 'retry' }, animations: [] };
        let attempt = 0;
        const loadSpy = jest.spyOn(GLTFLoader.prototype, 'load').mockImplementation((path, onLoad, onProgress, onError) => {
            attempt += 1;
            if (attempt === 1) {
                setTimeout(() => onError(expectedError), 0);
            } else {
                setTimeout(() => onLoad(fakeGltf), 0);
            }
        });

        await expect(MeshFactory.loadModel('./assets/retry.glb')).rejects.toThrow('404 not found');
        await expect(MeshFactory.loadModel('./assets/retry.glb')).resolves.toBe(fakeGltf);

        expect(loadSpy).toHaveBeenCalledTimes(2);

        loadSpy.mockRestore();
    });

    test('retries transient loader failures before rejecting', async () => {
        const transientError = new Error("Couldn't load texture blob:foo");
        const fakeGltf = { scene: { name: 'retry-transient' }, animations: [] };
        let attempt = 0;
        const loadSpy = jest.spyOn(GLTFLoader.prototype, 'load').mockImplementation((path, onLoad, onProgress, onError) => {
            attempt += 1;
            if (attempt < 3) {
                setTimeout(() => onError(transientError), 0);
            } else {
                setTimeout(() => onLoad(fakeGltf), 0);
            }
        });

        await expect(MeshFactory.loadModel('./assets/retry-transient.glb')).resolves.toBe(fakeGltf);
        expect(loadSpy).toHaveBeenCalledTimes(3);

        loadSpy.mockRestore();
    });

    test('configures alpha-cutout shadow settings for foliage-like materials', () => {
        const material = new THREE.MeshStandardMaterial({
            map: { isTexture: true },
            transparent: true,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

        MeshFactory.configureShadowCastingForObject(mesh, { isFoliage: true });

        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.material.transparent).toBe(false);
        expect(mesh.material.alphaTest).toBeGreaterThanOrEqual(0.5);
        expect(mesh.material.shadowSide).toBe(THREE.DoubleSide);
        expect(mesh.material.forceSinglePass).toBe(true);
        expect(mesh.material.alphaToCoverage).toBe(false);
    });
});

describe('MeshFactory preload phases', () => {
    test('startup preload excludes heavy world assets', () => {
        const startup = MeshFactory.getStartupPreloadModelPaths();
        expect(startup).not.toContain('./assets/buildings/trading_post.glb');
        expect(startup).not.toContain('./assets/buildings/dungeons/the_verdant_bastion.glb');
        expect(startup).not.toContain('./assets/archetypes/Fighter/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Rogue/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Wizard/idle.glb');
        expect(startup).not.toContain('./assets/archetypes/Cleric/idle.glb');
    });

    test('player-specific startup preload gates the selected actor and nearby hostile set', () => {
        const startup = MeshFactory.getStartupPreloadModelPaths('Cleric');

        expect(startup).toHaveLength(5);
        expect(startup).not.toContain('./assets/archetypes/Cleric/death.glb');
        expect(startup).not.toContain('./assets/archetypes/Fighter/idle.glb');
        expect(startup).toContain('./assets/enemies/undead/skeleton/idle.glb');
        expect(startup).not.toContain('./assets/objects/chests/stash_base.glb');
        expect(startup).not.toContain('./assets/summons/avenging_seraph/idle.glb');
    });

    test('background preload contains world assets', () => {
        const background = MeshFactory.getBackgroundPreloadModelPaths();
        expect(background).toContain('./assets/buildings/trading_post.glb');
        expect(background).toContain('./assets/buildings/dungeons/the_verdant_bastion.glb');
    });

    test('reports nonfatal preload failures so deferred scenery can stay optional', async () => {
        const expectedError = new Error('slow scenery asset');
        const loadSpy = jest.spyOn(MeshFactory, 'loadModelWithTimeout')
            .mockRejectedValueOnce(expectedError)
            .mockResolvedValueOnce({ scene: {} });
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            const result = await MeshFactory.preloadModels(
                ['./assets/slow.glb', './assets/ready.glb'],
                { concurrency: 1, timeoutMs: 50, failFast: false }
            );

            expect(result).toEqual({
                completed: 2,
                total: 2,
                failures: [{ path: './assets/slow.glb', error: expectedError }]
            });
            expect(loadSpy).toHaveBeenNthCalledWith(1, './assets/slow.glb', 50);
            expect(loadSpy).toHaveBeenNthCalledWith(2, './assets/ready.glb', 50);
        } finally {
            consoleWarn.mockRestore();
            loadSpy.mockRestore();
        }
    });
});

describe('MeshFactory catalog integration', () => {
    test('uses catalog-owned procedural enemy specs for compatibility', () => {
        expect(MeshFactory.PROCEDURAL_ENEMY_SPECS).toBe(MeshCatalog.getProceduralEnemySpecs());
        expect(MeshFactory.PROCEDURAL_ENEMY_SPECS.Cindermaw.shape).toBe('beast');
    });

    test('procedural enemies ship explicit idle, movement, attack, and death clips', () => {
        const mesh = MeshFactory.createProceduralEnemy(
            'Cindermaw',
            MeshFactory.PROCEDURAL_ENEMY_SPECS.Cindermaw
        );
        const clips = Object.fromEntries(mesh.userData.animations.map((clip) => [clip.name, clip]));

        expect(Object.keys(clips)).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
        expect(clips.Idle.tracks.length).toBeGreaterThan(0);
        expect(clips.Attack.tracks.length).toBeGreaterThan(0);
        expect(clips.Death.tracks.length).toBeGreaterThan(0);

        const firstPart = mesh.getObjectByName('ProceduralPart0');
        const originalRotation = firstPart.rotation.x;
        const mixer = new THREE.AnimationMixer(mesh);
        mixer.clipAction(clips.Attack).reset().play();
        mixer.update(0.28);

        expect(firstPart.rotation.x).not.toBeCloseTo(originalRotation, 4);
        mixer.stopAllAction();
        mixer.uncacheRoot(mesh);
    });

    test.each([
        ['Fighter', new THREE.BoxGeometry(1, 1, 1), 0xd84a3a, 0.5],
        ['Rogue', new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8), 0x4a8f54, 0.75],
        ['Wizard', new THREE.ConeGeometry(0.5, 1.5, 8), 0x496bd8, 0.75],
        ['Cleric', new THREE.SphereGeometry(0.6, 16, 16), 0xe0c95a, 0.6]
    ])('%s asset fallback remains fully animated', (type, geometry, color, centerY) => {
        const mesh = MeshFactory.createAnimatedPlayerFallback(type, geometry, color, centerY);
        const clipNames = mesh.userData.animations.map((entry) => entry.name);

        expect(mesh.userData.assetFallback).toBe(true);
        expect(mesh.userData.fallbackType).toBe(type);
        expect(clipNames).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
        expect(mesh.getObjectByName('ProceduralPart0')).not.toBeNull();
    });

    test('Fighter uses the procedural humanoid without requesting a GLB', async () => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType('Fighter');
            expect(mesh.userData.proceduralHumanoid).toBe(true);
            expect(mesh.userData.proceduralClass).toBe('Fighter');
            expect(mesh.userData.animations.map((entry) => entry.name))
                .toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test('Rogue uses the procedural shadeblade without requesting a GLB', async () => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType('Rogue');
            expect(mesh.userData.proceduralHumanoid).toBe(true);
            expect(mesh.userData.proceduralClass).toBe('Rogue');
            expect(mesh.userData.artStyle).toBe('Gloamreach shadeblade');
            expect(mesh.userData.animations.map((entry) => entry.name))
                .toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test('Wizard uses the procedural hexweaver without requesting a GLB', async () => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType('Wizard');
            expect(mesh.userData.proceduralHumanoid).toBe(true);
            expect(mesh.userData.proceduralClass).toBe('Wizard');
            expect(mesh.userData.artStyle).toBe('Stormcrown hexweaver');
            expect(mesh.userData.animations.map((entry) => entry.name))
                .toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test('Cleric uses the procedural gravepriest without requesting a GLB', async () => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType('Cleric');
            expect(mesh.userData.proceduralHumanoid).toBe(true);
            expect(mesh.userData.proceduralClass).toBe('Cleric');
            expect(mesh.userData.artStyle).toBe('Lanternhold gravepriest');
            expect(mesh.userData.animations.map((entry) => entry.name))
                .toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test.each([
        ['DwarfSalesman', 'Lanternhold ironmonger'],
        ['QuestNPC', 'Lanternhold oathscribe'],
        ['DungeonNPC', 'Lanternhold waywarden'],
        ['RespecNPC', 'Lanternhold ash confessor']
    ])('%s uses its procedural Lanternhold service silhouette without requesting a GLB', async (type, artStyle) => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType(type);
            expect(mesh.userData).toEqual(expect.objectContaining({
                proceduralTownActor: true,
                proceduralActorType: type,
                artStyle,
                sharedGeometry: true
            }));
            expect(mesh.userData.animations.map((entry) => entry.name)).toEqual(['Idle']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test('Avenging Seraph uses its procedural reliquary rig without requesting a GLB', async () => {
        const previousPool = MeshFactory.pool;
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        MeshFactory.pool = {};

        try {
            const mesh = await MeshFactory.createMeshForType('AvengingSeraph');
            expect(mesh.userData).toEqual(expect.objectContaining({
                proceduralSummon: true,
                proceduralActorType: 'AvengingSeraph',
                artStyle: 'Lanternhold reliquary seraph',
                combatRadius: 1.5,
                sharedGeometry: true
            }));
            expect(mesh.userData.animations.map((entry) => entry.name))
                .toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            MeshFactory.pool = previousPool;
            loadSpy.mockRestore();
        }
    });

    test('a full Avenging Seraph pool never disposes shared generated resources', async () => {
        const previousPool = MeshFactory.pool;
        MeshFactory.pool = {};
        const mesh = await MeshFactory.createMeshForType('AvengingSeraph');
        MeshFactory.pool.AvengingSeraph = Array.from({ length: 50 }, () => new THREE.Group());
        const material = mesh.getObjectByName('AvengingSeraph_BurialMask').material;
        const disposeSpy = jest.spyOn(material, 'dispose');

        try {
            MeshFactory.releaseMesh('AvengingSeraph', mesh);
            expect(disposeSpy).not.toHaveBeenCalled();
            expect(MeshFactory.pool.AvengingSeraph).toHaveLength(50);
        } finally {
            disposeSpy.mockRestore();
            MeshFactory.pool = previousPool;
        }
    });

    test('a full town actor pool never disposes shared generated resources', async () => {
        const previousPool = MeshFactory.pool;
        MeshFactory.pool = {};
        const mesh = await MeshFactory.createMeshForType('QuestNPC');
        MeshFactory.pool.QuestNPC = Array.from({ length: 50 }, () => new THREE.Group());
        const material = mesh.getObjectByName('QuestNPC_Torso').material;
        const disposeSpy = jest.spyOn(material, 'dispose');

        try {
            MeshFactory.releaseMesh('QuestNPC', mesh);
            expect(disposeSpy).not.toHaveBeenCalled();
            expect(MeshFactory.pool.QuestNPC).toHaveLength(50);
        } finally {
            disposeSpy.mockRestore();
            MeshFactory.pool = previousPool;
        }
    });

    test('a full Rogue pool never disposes shared procedural render resources', async () => {
        const previousPool = MeshFactory.pool;
        MeshFactory.pool = {};
        const mesh = await MeshFactory.createMeshForType('Rogue');
        MeshFactory.pool.Rogue = Array.from({ length: 50 }, () => new THREE.Group());
        const material = mesh.getObjectByName('Rogue_Jerkin').material;
        const disposeSpy = jest.spyOn(material, 'dispose');

        try {
            MeshFactory.releaseMesh('Rogue', mesh);
            expect(disposeSpy).not.toHaveBeenCalled();
            expect(MeshFactory.pool.Rogue).toHaveLength(50);
        } finally {
            disposeSpy.mockRestore();
            MeshFactory.pool = previousPool;
        }
    });
});
