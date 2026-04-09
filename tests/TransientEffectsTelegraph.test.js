import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createTransientEffect } from '../src/core/TransientEffects.js';

describe('Transient telegraph readability', () => {
    test('creates stronger boss telegraphs with danger-tier visuals and label sprite', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'telegraph',
            new THREE.Vector3(4, 0, 7),
            0xff2200,
            {
                radius: 12,
                telegraphDuration: 2.5,
                threatTier: 'boss',
                label: 'BOSS'
            }
        );

        expect(effect).not.toBeNull();
        expect(effect.meshes).toHaveLength(3);

        const [ring, fill, label] = effect.meshes;
        expect(ring.material.color.getHex()).toBe(0xff3b30);
        expect(fill.material.color.getHex()).toBe(0xff6b57);
        expect(ring.material.opacity).toBeGreaterThan(0.6);
        expect(fill.material.opacity).toBeGreaterThan(0.18);
        expect(label.position.y).toBeGreaterThan(ring.position.y);
        expect(label.userData.text).toBe('BOSS');
    });

    test('uses lighter visuals for minor telegraphs without labels', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'telegraph',
            new THREE.Vector3(0, 0, 0),
            0xff2200,
            {
                radius: 6,
                telegraphDuration: 1.5,
                threatTier: 'minor'
            }
        );

        expect(effect).not.toBeNull();
        expect(effect.meshes).toHaveLength(2);

        const [ring, fill] = effect.meshes;
        expect(ring.material.color.getHex()).toBe(0xffd54a);
        expect(fill.material.color.getHex()).toBe(0xfff0a8);
        expect(ring.material.opacity).toBeLessThan(0.5);
        expect(fill.material.opacity).toBeLessThan(0.12);
    });

    test('creates a grounded dust-ring impact for jump landings', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'jump_land',
            new THREE.Vector3(2, 0, -3),
            0xd8d2c4,
            {
                impact: 0.9,
                className: 'Rogue'
            }
        );

        expect(effect).not.toBeNull();
        expect(effect.meshes).toHaveLength(1);

        const group = effect.meshes[0];
        expect(group.children).toHaveLength(3);
        const [ring, dust, burstDust] = group.children;
        expect(ring.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
        expect(ring.position.y).toBeGreaterThan(0);
        expect(dust.position.y).toBeGreaterThan(0);
        expect(burstDust.position.y).toBeGreaterThan(0);
        expect(dust.material.opacity).toBeGreaterThan(0.3);
        expect(burstDust.material.opacity).toBeGreaterThan(0.2);
    });

    test('scales sphere effects from projectile-provided radius and duration', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'sphere',
            new THREE.Vector3(1, 0, 2),
            0xff4500,
            {
                radius: 7,
                duration: 0.45
            }
        );

        expect(effect).not.toBeNull();
        expect(effect.duration).toBeCloseTo(0.45, 5);
        expect(effect.meshes).toHaveLength(1);
        expect(effect.meshes[0].geometry.parameters.radius).toBeCloseTo(7, 5);
    });

    test('disposes transient meshes from their current parent after reparenting', () => {
        const scene = new THREE.Scene();
        const otherParent = new THREE.Group();
        const effect = createTransientEffect(
            scene,
            'sphere',
            new THREE.Vector3(1, 0, 2),
            0xff4500,
            {
                radius: 3,
                duration: 0.1
            }
        );

        const mesh = effect.meshes[0];
        const geometryDispose = jest.spyOn(mesh.geometry, 'dispose');
        const materialDispose = jest.spyOn(mesh.material, 'dispose');
        otherParent.add(mesh);

        effect.update(0.2);

        expect(otherParent.children).toHaveLength(0);
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        expect(effect.isActive).toBe(false);
    });
});
