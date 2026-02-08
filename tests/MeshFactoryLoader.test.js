import { MeshFactory } from '../src/utils/MeshFactory.js';
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

    test('clears inflight entry after loader error so retry can proceed', async () => {
        const expectedError = new Error('load failed');
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

        await expect(MeshFactory.loadModel('./assets/retry.glb')).rejects.toThrow('load failed');
        await expect(MeshFactory.loadModel('./assets/retry.glb')).resolves.toBe(fakeGltf);

        expect(loadSpy).toHaveBeenCalledTimes(2);

        loadSpy.mockRestore();
    });
});
