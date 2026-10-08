import { jest } from '@jest/globals';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { ASSET_VERSION_OVERRIDES, DEFAULT_ASSET_VERSION, resolveAssetPath } from '../src/assets/assetManifest.js';
import { AUTHORED_ASSET_VERSIONS } from '../src/assets/authoredEquipment.generated.js';
import { ILYRA_MODEL_PATH } from '../src/art/AuthoredIlyra.js';

describe('asset URL versioning', () => {
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

    test('resolveAssetPath appends a stable version query to local model assets', () => {
        expect(resolveAssetPath('./assets/archetypes/Fighter/idle.glb')).toBe(
            `./assets/archetypes/Fighter/idle.glb?v=${DEFAULT_ASSET_VERSION}`
        );
    });

    test('resolveAssetPath preserves existing query params while adding the asset version', () => {
        expect(resolveAssetPath('./assets/example.glb?quality=high')).toBe(
            `./assets/example.glb?quality=high&v=${DEFAULT_ASSET_VERSION}`
        );
    });

    test('retired dungeon models no longer need a special cache-version override', () => {
        expect(ASSET_VERSION_OVERRIDES).toEqual({ ...AUTHORED_ASSET_VERSIONS, [ILYRA_MODEL_PATH]: '010301379aaa92a3' });
        expect(Object.keys(ASSET_VERSION_OVERRIDES)).toHaveLength(737);
        expect(Object.keys(ASSET_VERSION_OVERRIDES).some(path => path.includes('/buildings/'))).toBe(false);
        expect(resolveAssetPath('./assets/buildings/dungeons/the_verdant_bastion.glb')).toBe(
            `./assets/buildings/dungeons/the_verdant_bastion.glb?v=${DEFAULT_ASSET_VERSION}`
        );
    });

    test('MeshFactory.loadModel requests the versioned asset URL', async () => {
        const fakeGltf = { scene: { name: 'scene' }, animations: [] };
        const loadSpy = jest.spyOn(GLTFLoader.prototype, 'load').mockImplementation((path, onLoad) => {
            setTimeout(() => onLoad(fakeGltf), 0);
        });

        await expect(MeshFactory.loadModel('./assets/archetypes/Fighter/idle.glb')).resolves.toBe(fakeGltf);
        expect(loadSpy).toHaveBeenCalledWith(
            `./assets/archetypes/Fighter/idle.glb?v=${DEFAULT_ASSET_VERSION}`,
            expect.any(Function),
            undefined,
            expect.any(Function)
        );

        loadSpy.mockRestore();
    });
});
