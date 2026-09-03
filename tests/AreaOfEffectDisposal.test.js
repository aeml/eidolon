import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AreaOfEffect } from '../src/entities/AreaOfEffect.js';
import { ChunkManager } from '../src/core/ChunkManager.js';

describe('AreaOfEffect disposal', () => {
    test('ChunkManager.removeEntity releases expired area visuals without destroying shared art resources', () => {
        const scene = new THREE.Group();
        const chunkManager = new ChunkManager(scene, 16);
        const gameEngine = {
            getUniqueId: () => 'aoe-1',
            floatingTextManager: { spawn: jest.fn() }
        };
        const owner = { constructor: { name: 'Wizard' } };
        const aoe = new AreaOfEffect(gameEngine, owner, new THREE.Vector3(3, 0, 4), {
            radius: 4,
            duration: 0.1,
            effectType: 'GravityWell'
        });

        scene.add(aoe.mesh);
        const otherParent = new THREE.Group();
        scene.remove(aoe.mesh);
        otherParent.add(aoe.mesh);

        const visualRoot = aoe.mesh;
        const renderedPart = visualRoot.children.find((part) => part.geometry && part.material);
        const geometryDispose = jest.spyOn(renderedPart.geometry, 'dispose');
        const materialDispose = jest.spyOn(renderedPart.material, 'dispose');

        aoe.update(0.2, null, null, null, null);
        expect(aoe.isActive).toBe(false);

        chunkManager.removeEntity(aoe);

        expect(otherParent.children).toHaveLength(0);
        expect(visualRoot.children).toHaveLength(0);
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(materialDispose).not.toHaveBeenCalled();
        expect(aoe.mesh).toBeNull();
    });
});
