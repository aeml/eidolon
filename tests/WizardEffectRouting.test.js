import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Wizard } from '../src/entities/Wizard.js';
import { spawnSceneFallbackBeam } from '../src/entities/EffectSceneFallback.js';

describe('Wizard combat effect routing', () => {
    test('Scorch Beam routes the beam telegraph through transient effects without direct scene writes', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.position.set(0, 0, 0);
        wizard.unlockedSkills.push('Scorch Beam');

        const spawnTransientEffect = jest.fn(() => true);
        const gameEngine = {
            chunkManager: { getActiveEntities: () => [] },
            floatingTextManager: { spawn: jest.fn() },
            spawnTransientEffect,
            effectScene: new THREE.Group(),
            scene: null
        };

        const target = new THREE.Vector3(8, 0, 0);
        wizard.useAbility(target, gameEngine, 'Scorch Beam');

        expect(spawnTransientEffect).toHaveBeenCalledTimes(1);
        const [type, position, color, options] = spawnTransientEffect.mock.calls[0];
        expect(type).toBe('beam');
        expect(color).toBe(0xffb136);
        expect(position.x).toBeCloseTo(target.x, 5);
        expect(position.y).toBeCloseTo(target.y, 5);
        expect(options.source).toBe(wizard);
        expect(options.abilityName).toBe('Scorch Beam');
    });

    test('Scorch Beam ignores non-combat world entities along its line', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.position.set(0, 0, 0);
        wizard.unlockedSkills.push('Scorch Beam');
        const worldProp = {
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(4, 1.5, 0),
            constructor: { name: 'QuestMarker' }
        };

        expect(() => wizard.useAbility(
            new THREE.Vector3(8, 0, 0),
            {
                chunkManager: { getActiveEntities: () => [worldProp] },
                floatingTextManager: { spawn: jest.fn() },
                spawnTransientEffect: jest.fn(() => true),
                effectScene: new THREE.Group(),
                scene: null
            },
            'Scorch Beam'
        )).not.toThrow();
    });

    test('Scorch Beam fallback cleans up from the current parent after the beam mesh is reparented', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.position.set(0, 0, 0);
        wizard.unlockedSkills.push('Scorch Beam');

        const firstEffectScene = new THREE.Group();
        const secondEffectScene = new THREE.Group();
        const queuedFrames = [];
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = (callback) => {
            queuedFrames.push(callback);
            return queuedFrames.length;
        };

        try {
            wizard.useAbility(
                new THREE.Vector3(8, 0, 0),
                {
                    chunkManager: { getActiveEntities: () => [] },
                    floatingTextManager: { spawn: jest.fn() },
                    spawnTransientEffect: undefined,
                    effectScene: firstEffectScene,
                    scene: null
                },
                'Scorch Beam'
            );

            expect(firstEffectScene.children).toHaveLength(1);
            const beamMesh = firstEffectScene.children[0];
            firstEffectScene.remove(beamMesh);
            secondEffectScene.add(beamMesh);
            expect(beamMesh.parent).toBe(secondEffectScene);

            while (queuedFrames.length > 0) {
                const frame = queuedFrames.shift();
                frame();
            }

            expect(secondEffectScene.children).toHaveLength(0);
            expect(beamMesh.parent).toBeNull();
        } finally {
            global.requestAnimationFrame = originalRaf;
        }
    });

    test('generic Wizard fallback visuals create an effectScene mesh when transient effects are unavailable', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        const effectScene = new THREE.Group();
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = () => 0;

        try {
            wizard.spawnVisualEffect(
                {
                    scene: null,
                    effectScene,
                    spawnTransientEffect: undefined
                },
                new THREE.Vector3(4, 0, 1),
                0x33bbff,
                'impact'
            );
        } finally {
            global.requestAnimationFrame = originalRaf;
        }

        expect(effectScene.children).toHaveLength(1);
        expect(effectScene.children[0].material.color.getHex()).toBe(0x33bbff);
    });

    test('shared beam fallback creates and cleans up a parent-safe beam mesh', () => {
        const firstEffectScene = new THREE.Group();
        const secondEffectScene = new THREE.Group();
        const queuedFrames = [];
        const originalRaf = global.requestAnimationFrame;
        global.requestAnimationFrame = (callback) => {
            queuedFrames.push(callback);
            return queuedFrames.length;
        };

        try {
            const created = spawnSceneFallbackBeam(
                firstEffectScene,
                new THREE.Vector3(0, 1.5, 0),
                new THREE.Vector3(12, 1.5, 0),
                0xffaa00
            );

            expect(created).toBe(true);
            expect(firstEffectScene.children).toHaveLength(1);
            const beamMesh = firstEffectScene.children[0];
            firstEffectScene.remove(beamMesh);
            secondEffectScene.add(beamMesh);

            while (queuedFrames.length > 0) {
                const frame = queuedFrames.shift();
                frame();
            }

            expect(secondEffectScene.children).toHaveLength(0);
            expect(beamMesh.parent).toBeNull();
        } finally {
            global.requestAnimationFrame = originalRaf;
        }
    });
});
