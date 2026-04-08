import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Projectile } from '../src/entities/Projectile.js';

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
});
