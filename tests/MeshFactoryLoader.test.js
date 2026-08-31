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
        expect(startup).toContain('./assets/archetypes/Fighter/idle.glb');
    });

    test('player-specific startup preload gates only the selected local actor', () => {
        const startup = MeshFactory.getStartupPreloadModelPaths('Cleric');

        expect(startup).toHaveLength(5);
        expect(startup).toContain('./assets/archetypes/Cleric/death.glb');
        expect(startup).not.toContain('./assets/archetypes/Fighter/idle.glb');
        expect(startup).not.toContain('./assets/enemies/undead/skeleton/idle.glb');
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
});
