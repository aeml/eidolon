import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Projectile, resetProjectileParticlePoolForTests } from '../src/entities/Projectile.js';

function createOwner() {
    return {
        stats: {
            intelligence: 20,
            dexterity: 12
        },
        isMultiplayer: false,
        isRemote: false,
        constructor: { name: 'Wizard' }
    };
}

function createEnemy(position = new THREE.Vector3(0, 0, 0)) {
    return {
        id: 'enemy-1',
        position,
        radius: 0.5,
        isActive: true,
        state: 'IDLE',
        constructor: { name: 'Skeleton' },
        takeDamage: jest.fn()
    };
}

describe('Projectile combat effect routing', () => {
    beforeEach(() => {
        resetProjectileParticlePoolForTests();
    });

    test('ArcaneMissile impact routes readability burst through transient effects without entity scene access', () => {
        const owner = createOwner();
        const enemy = createEnemy(new THREE.Vector3(0.25, 0, 0));
        const projectile = new Projectile('arcane-1', owner, 'ArcaneMissile', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const spawnTransientEffect = jest.fn(() => true);

        projectile.update(
            0,
            null,
            null,
            { getActiveEntities: () => [enemy] },
            { spawn: jest.fn() },
            {
                scene: null,
                effectScene: new THREE.Group(),
                spawnTransientEffect
            }
        );

        expect(projectile.isActive).toBe(false);
        expect(spawnTransientEffect).toHaveBeenCalledTimes(1);

        const [type, position, color, options] = spawnTransientEffect.mock.calls[0];
        expect(type).toBe('impact');
        expect(color).toBe(0xaa00ff);
        expect(position).toBe(projectile.position);
        expect(options).toEqual({ source: owner });
    });

    test('Meteor explosion routes splash readability through transient effects with the explosion radius', () => {
        const owner = createOwner();
        const primaryEnemy = createEnemy(new THREE.Vector3(0.1, 0, 0));
        const splashEnemy = createEnemy(new THREE.Vector3(3, 0, 0));
        splashEnemy.id = 'enemy-2';
        const projectile = new Projectile('meteor-1', owner, 'Meteor', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        projectile.explosionRadius = 9;
        const spawnTransientEffect = jest.fn(() => true);

        projectile.update(
            0,
            null,
            null,
            { getActiveEntities: () => [primaryEnemy, splashEnemy] },
            { spawn: jest.fn() },
            {
                scene: null,
                effectScene: new THREE.Group(),
                spawnTransientEffect
            }
        );

        expect(projectile.isActive).toBe(false);
        expect(spawnTransientEffect).toHaveBeenCalledTimes(1);

        const [type, position, color, options] = spawnTransientEffect.mock.calls[0];
        expect(type).toBe('sphere');
        expect(color).toBe(0xff2200);
        expect(position).toBe(projectile.position);
        expect(options).toEqual({ source: owner, radius: 9, duration: 0.45 });
    });

    test('ArcaneMissile impact falls back to effectScene instead of entity scene when transient effects are unavailable', () => {
        const owner = createOwner();
        const enemy = createEnemy(new THREE.Vector3(0.25, 0, 0));
        const projectile = new Projectile('arcane-fallback-1', owner, 'ArcaneMissile', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const effectScene = new THREE.Group();
        const gameEngine = {
            scene: null,
            effectScene,
            spawnTransientEffect: undefined
        };

        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = () => 0;
        try {
            projectile.update(
                0,
                null,
                null,
                { getActiveEntities: () => [enemy] },
                { spawn: jest.fn() },
                gameEngine
            );
        } finally {
            global.requestAnimationFrame = originalRaf;
        }

        expect(projectile.isActive).toBe(false);
        expect(effectScene.children).toHaveLength(1);
        expect(effectScene.children[0].position).toEqual(projectile.position);
        expect(effectScene.children[0].material.color.getHex()).toBe(0xaa00ff);
    });

    test('Meteor explosion falls back to effectScene instead of entity scene when transient effects are unavailable', () => {
        const owner = createOwner();
        const primaryEnemy = createEnemy(new THREE.Vector3(0.1, 0, 0));
        const projectile = new Projectile('meteor-fallback-1', owner, 'Meteor', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        projectile.explosionRadius = 6;
        const effectScene = new THREE.Group();
        const gameEngine = {
            scene: null,
            effectScene,
            spawnTransientEffect: undefined
        };

        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = () => 0;
        try {
            projectile.update(
                0,
                null,
                null,
                { getActiveEntities: () => [primaryEnemy] },
                { spawn: jest.fn() },
                gameEngine
            );
        } finally {
            global.requestAnimationFrame = originalRaf;
        }

        expect(projectile.isActive).toBe(false);
        expect(effectScene.children).toHaveLength(2);
        expect(effectScene.children[0].material.color.getHex()).toBe(0xffaa00);
        expect(effectScene.children[1].position).toEqual(projectile.position);
        expect(effectScene.children[1].material.color.getHex()).toBe(0xff2200);
    });

    test('Meteor trail particles reparent to the current effectScene when the particle pool reuses an inactive mesh', () => {
        const owner = createOwner();
        const projectileA = new Projectile('meteor-reparent-a', owner, 'Meteor', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const projectileB = new Projectile('meteor-reparent-b', owner, 'Meteor', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const firstEffectScene = new THREE.Group();
        const secondEffectScene = new THREE.Group();
        const queuedFrames = [];
        const originalRaf = global.requestAnimationFrame;
        const originalNow = global.performance.now;
        global.requestAnimationFrame = (callback) => {
            queuedFrames.push(callback);
            return queuedFrames.length;
        };

        let now = 0;
        global.performance.now = () => now;

        try {
            projectileA.update(
                0.016,
                null,
                null,
                { getActiveEntities: () => [] },
                { spawn: jest.fn() },
                { scene: null, effectScene: firstEffectScene, spawnTransientEffect: undefined }
            );

            expect(firstEffectScene.children).toHaveLength(1);
            const pooledMesh = firstEffectScene.children[0];

            now = 300;
            const firstFrame = queuedFrames.shift();
            expect(typeof firstFrame).toBe('function');
            firstFrame();
            expect(pooledMesh.visible).toBe(false);

            projectileB.update(
                0.016,
                null,
                null,
                { getActiveEntities: () => [] },
                { spawn: jest.fn() },
                { scene: null, effectScene: secondEffectScene, spawnTransientEffect: undefined }
            );

            expect(firstEffectScene.children).toHaveLength(0);
            expect(secondEffectScene.children).toContain(pooledMesh);
            expect(pooledMesh.parent).toBe(secondEffectScene);
        } finally {
            global.requestAnimationFrame = originalRaf;
            global.performance.now = originalNow;
        }
    });

    test('ArcaneMissile fallback burst cleans up from the current parent after reparenting', () => {
        const owner = createOwner();
        const enemy = createEnemy(new THREE.Vector3(0.25, 0, 0));
        const projectile = new Projectile('arcane-reparent-cleanup-1', owner, 'ArcaneMissile', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const firstEffectScene = new THREE.Group();
        const secondEffectScene = new THREE.Group();
        const queuedFrames = [];
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = (callback) => {
            queuedFrames.push(callback);
            return queuedFrames.length;
        };

        try {
            projectile.update(
                0,
                null,
                null,
                { getActiveEntities: () => [enemy] },
                { spawn: jest.fn() },
                {
                    scene: null,
                    effectScene: firstEffectScene,
                    spawnTransientEffect: undefined
                }
            );

            expect(firstEffectScene.children).toHaveLength(1);
            const burstMesh = firstEffectScene.children[0];
            firstEffectScene.remove(burstMesh);
            secondEffectScene.add(burstMesh);
            expect(burstMesh.parent).toBe(secondEffectScene);

            while (queuedFrames.length > 0) {
                const frame = queuedFrames.shift();
                frame();
            }

            expect(secondEffectScene.children).toHaveLength(0);
            expect(burstMesh.parent).toBeNull();
        } finally {
            global.requestAnimationFrame = originalRaf;
        }
    });

    test('resetProjectileParticlePoolForTests removes pooled particles from their current parent after reparenting', () => {
        const owner = createOwner();
        const projectile = new Projectile('meteor-dispose-reparent-1', owner, 'Meteor', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
        const firstEffectScene = new THREE.Group();
        const secondEffectScene = new THREE.Group();
        const queuedFrames = [];
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = (callback) => {
            queuedFrames.push(callback);
            return queuedFrames.length;
        };

        try {
            projectile.update(
                0.016,
                null,
                null,
                { getActiveEntities: () => [] },
                { spawn: jest.fn() },
                { scene: null, effectScene: firstEffectScene, spawnTransientEffect: undefined }
            );

            expect(firstEffectScene.children).toHaveLength(1);
            const pooledMesh = firstEffectScene.children[0];
            firstEffectScene.remove(pooledMesh);
            secondEffectScene.add(pooledMesh);
            expect(pooledMesh.parent).toBe(secondEffectScene);

            resetProjectileParticlePoolForTests();

            expect(secondEffectScene.children).toHaveLength(0);
            expect(pooledMesh.parent).toBeNull();
        } finally {
            global.requestAnimationFrame = originalRaf;
        }
    });
});
