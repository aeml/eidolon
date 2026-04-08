import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Rogue } from '../src/entities/Rogue.js';
import { Actor } from '../src/entities/Actor.js';

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
    });

    test('triggered Tripwire clears its persistent visual from effectScene and spawns smoke through transient effects', () => {
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
        const enemy = Object.create(Actor.prototype);
        enemy.isActive = true;
        enemy.state = 'IDLE';
        enemy.position = rogue.traps[0].position.clone();
        enemy.rootTimer = 0;
        enemy.constructor = { name: 'Skeleton' };

        rogue.update(0.016, null, null, { getActiveEntities: () => [enemy] }, gameEngine.floatingTextManager, gameEngine);

        expect(rogue.traps).toHaveLength(0);
        expect(effectScene.children).toHaveLength(0);
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
});
