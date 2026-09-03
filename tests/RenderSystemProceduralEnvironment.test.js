import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { PROCEDURAL_TERRAIN_DEFINITIONS } from '../src/art/ProceduralRealmTerrain.js';

function createEnvironmentHarness(quality) {
    const renderSystem = Object.create(RenderSystem.prototype);
    renderSystem.graphicsQuality = quality;
    renderSystem.isMobile = false;
    renderSystem.scene = new THREE.Scene();
    renderSystem.staticEnvironmentGroup = new THREE.Group();
    renderSystem.scene.add(renderSystem.staticEnvironmentGroup);
    renderSystem.renderer = {
        capabilities: { getMaxAnisotropy: () => 8 }
    };
    renderSystem.createWaterMaterial = (texture) => new THREE.MeshBasicMaterial({ map: texture });
    renderSystem.initRealmParticles = jest.fn(() => {
        renderSystem._pMesh = { proceduralTestSentinel: true };
    });
    return renderSystem;
}

function disposeHarness(renderSystem) {
    const textures = new Set([
        renderSystem.backgroundTexture,
        renderSystem.waterTexture,
        ...Object.values(renderSystem.terrainTextures || {})
    ].filter(Boolean));
    renderSystem.staticEnvironmentGroup.traverse((object) => {
        object.geometry?.dispose?.();
        object.material?.dispose?.();
    });
    textures.forEach((texture) => texture.dispose());
}

describe.each(['high', 'low'])('RenderSystem procedural environment (%s)', (quality) => {
    test('creates exact realm footprints without authored texture loading and remains idempotent', async () => {
        const renderSystem = createEnvironmentHarness(quality);
        const loadSpy = jest.spyOn(THREE.TextureLoader.prototype, 'loadAsync');
        const progress = [];

        try {
            await renderSystem.preloadEnvironment((percent, label) => progress.push([percent, label]));
            await renderSystem.preloadEnvironment();

            expect(loadSpy).not.toHaveBeenCalled();
            expect(progress.map(([percent]) => percent)).toEqual([0, 25, 50, 100]);
            expect(progress.at(-1)[1]).toContain('codeborn realms ready');
            expect(renderSystem.scene.background).toBe(renderSystem.backgroundTexture);
            expect(renderSystem.backgroundTexture.isDataTexture).toBe(true);
            expect(renderSystem.waterTexture.isDataTexture).toBe(true);
            expect(renderSystem.waterPlane.position.toArray()).toEqual([0, -5, 0]);
            expect(renderSystem.waterPlane.geometry.parameters).toEqual(expect.objectContaining({
                width: 10000,
                height: 10000
            }));
            expect(renderSystem.staticEnvironmentGroup.children).toHaveLength(6);
            expect(renderSystem.initRealmParticles).toHaveBeenCalledTimes(1);

            const realmSurfaces = [
                ['groundEarth', 'earth', [0, 0, 200], [1998.5, 1598.5]],
                ['groundSnow', 'water', [0, 0, -1400], [1998.5, 1598.5]],
                ['groundFire', 'fire', [-2000, 0, 200], [1998.5, 1598.5]],
                ['groundAir', 'air', [2000, 0, 200], [1998.5, 1598.5]],
                ['groundTown', 'town', [0, 0.025, 200], [198.5, 198.5]]
            ];
            for (const [property, key, position, dimensions] of realmSurfaces) {
                const surface = renderSystem[property];
                expect(surface.position.toArray()).toEqual(position);
                expect([surface.geometry.parameters.width, surface.geometry.parameters.height]).toEqual(dimensions);
                expect(surface.userData).toEqual(expect.objectContaining({
                    proceduralTerrain: true,
                    terrainKey: key,
                    terrainId: PROCEDURAL_TERRAIN_DEFINITIONS[key].id,
                    motif: PROCEDURAL_TERRAIN_DEFINITIONS[key].motif
                }));
                expect(surface.material.map).toBe(renderSystem.terrainTextures[key]);
                expect(surface.material.map.userData.quality).toBe(quality);
                expect(surface.material.map.userData.resolution).toBe(quality === 'low' ? 128 : 256);
            }
        } finally {
            loadSpy.mockRestore();
            disposeHarness(renderSystem);
        }
    });
});
