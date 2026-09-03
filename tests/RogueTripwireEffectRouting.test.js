import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Rogue } from '../src/entities/Rogue.js';
import { Actor } from '../src/entities/Actor.js';
import { createPersistentSceneMesh } from '../src/entities/EffectSceneFallback.js';

function createRogue() {
    const rogue = new Rogue('rogue-1');
    rogue.mesh = new THREE.Group();
    rogue.position.set(4, 0, 6);
    return rogue;
}

describe('Rogue Tripwire effect routing', () => {
    test('Tripwire plants its persistent trap visual in effectScene without entity scene access', () => {
        const rogue = createRogue();
        const effectScene = new THREE.Group();
        const gameEngine = {
            scene: null,
            effectScene,
            floatingTextManager: { spawn: jest.fn() }
        };

        rogue.useAbility(new THREE.Vector3(4, 0, 6), gameEngine, 'Tripwire');

        expect(rogue.traps).toHaveLength(1);
        expect(rogue.traps[0].mesh.parent).toBe(effectScene);
        expect(effectScene.children).toContain(rogue.traps[0].mesh);
        expect(rogue.traps[0].mesh.userData).toEqual(expect.objectContaining({
            proceduralProjectile: true,
            projectileType: 'Tripwire',
            gameplayRadius: 1.5
        }));
        expect(rogue.traps[0].radius).toBe(1.5);
    });

    test('triggered Tripwire clears its persistent visual from effectScene, disposes it, and spawns smoke through transient effects', () => {
        const rogue = createRogue();
        const effectScene = new THREE.Group();
        const spawnTransientEffect = jest.fn(() => true);
        const gameEngine = {
            scene: null,
            effectScene,
            spawnTransientEffect,
            floatingTextManager: { spawn: jest.fn() }
        };

        rogue.useAbility(new THREE.Vector3(4, 0, 6), gameEngine, 'Tripwire');
        const trapMesh = rogue.traps[0].mesh;
        const trapPart = trapMesh.getObjectByProperty('isMesh', true);
        const geometryDispose = jest.spyOn(trapPart.geometry, 'dispose');
        const materialDispose = jest.spyOn(trapPart.material, 'dispose');
        const enemy = Object.create(Actor.prototype);
        enemy.isActive = true;
        enemy.state = 'IDLE';
        enemy.position = rogue.traps[0].position.clone();
        enemy.rootTimer = 0;
        enemy.constructor = { name: 'Skeleton' };

        rogue.update(0.016, null, null, { getActiveEntities: () => [enemy] }, gameEngine.floatingTextManager, gameEngine);

        expect(rogue.traps).toHaveLength(0);
        expect(effectScene.children).toHaveLength(0);
        expect(trapMesh.children).toHaveLength(0);
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(materialDispose).not.toHaveBeenCalled();
        expect(spawnTransientEffect).toHaveBeenCalledWith('smoke', expect.any(THREE.Vector3), 0xaaaaaa, { source: rogue });
    });

    test('generic Rogue fallback visuals create an effectScene mesh when transient effects are unavailable', () => {
        const rogue = createRogue();
        const effectScene = new THREE.Group();
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = () => 0;

        try {
            rogue.spawnVisualEffect(
                {
                    scene: null,
                    effectScene,
                    spawnTransientEffect: undefined
                },
                new THREE.Vector3(4, 0, 6),
                0x8844ff,
                'burst'
            );
        } finally {
            global.requestAnimationFrame = originalRaf;
        }

        expect(effectScene.children).toHaveLength(1);
        expect(effectScene.children[0].material.color.getHex()).toBe(0x8844ff);
    });

    test('shared persistent scene helper creates a parented trap mesh and disposes immediately when no scene exists', () => {
        const effectScene = new THREE.Group();
        const mesh = createPersistentSceneMesh(effectScene, {
            geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8),
            material: new THREE.MeshBasicMaterial({ color: 0x888888 }),
            position: new THREE.Vector3(4, 0.05, 6)
        });

        expect(mesh).toBeTruthy();
        expect(mesh.parent).toBe(effectScene);
        expect(effectScene.children).toContain(mesh);

        const strayGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
        const strayMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const geometryDispose = jest.spyOn(strayGeometry, 'dispose');
        const materialDispose = jest.spyOn(strayMaterial, 'dispose');

        const missingSceneMesh = createPersistentSceneMesh(null, {
            geometry: strayGeometry,
            material: strayMaterial,
            position: new THREE.Vector3(4, 0.05, 6)
        });

        expect(missingSceneMesh).toBeNull();
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
    });
});
