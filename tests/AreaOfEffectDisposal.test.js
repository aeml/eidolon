import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AreaOfEffect } from '../src/entities/AreaOfEffect.js';
import { ChunkManager } from '../src/core/ChunkManager.js';

describe('AreaOfEffect disposal', () => {
    test('ChunkManager.removeEntity disposes expired area visuals from their current parent', () => {
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
            color: 0x55ccff,
            visualType: 'ring'
        });

        scene.add(aoe.mesh);
        const otherParent = new THREE.Group();
        scene.remove(aoe.mesh);
        otherParent.add(aoe.mesh);

        const geometryDispose = jest.spyOn(aoe.mesh.geometry, 'dispose');
        const materialDispose = jest.spyOn(aoe.mesh.material, 'dispose');

        aoe.update(0.2, null, null, null, null);
        expect(aoe.isActive).toBe(false);

        chunkManager.removeEntity(aoe);

        expect(otherParent.children).toHaveLength(0);
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        expect(aoe.mesh).toBeNull();
    });
});
