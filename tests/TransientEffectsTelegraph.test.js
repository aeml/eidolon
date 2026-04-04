import * as THREE from 'three';
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
});
