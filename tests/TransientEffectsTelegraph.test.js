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
        effect.update(0.5);
        expect(label.scale.x).toBeGreaterThan(6.5);
        expect(label.scale.y).toBeGreaterThan(1.8);
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

    test.each([
        ['verdant_bastion_catacombs', 0xb8ff72, 'RootThorn:'],
        ['molten_core', 0xff7a24, 'MagmaFault:'],
        ['tempest_spire', 0x8cecff, 'LightningConductor:'],
        ['abyssal_well', 0x55f1dc, 'UndertowRing:']
    ])('gives %s boss danger its own procedural ground language', (theme, ringColor, motifPrefix) => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'telegraph',
            new THREE.Vector3(0, 0, 0),
            0xff2200,
            {
                radius: 10,
                telegraphDuration: 2,
                threatTier: 'boss',
                label: 'DANGER',
                theme,
                attack: 'regional_slam'
            }
        );

        expect(effect).not.toBeNull();
        expect(effect.meshes).toHaveLength(4);
        const [ring, , motif, label] = effect.meshes;
        expect(ring.material.color.getHex()).toBe(ringColor);
        expect(motif.userData.dungeonTelegraphTheme).toBe(theme);
        expect(motif.userData.attack).toBe('regional_slam');
        expect(motif.children.some((child) => child.name.startsWith(motifPrefix))).toBe(true);
        expect(label.userData.text).toBe('DANGER');
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

    test('renders an ability boundary ring at the supplied gameplay radius', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'ring',
            new THREE.Vector3(0, 0, 0),
            0xfff4a3,
            { radius: 16 }
        );

        const ring = effect.meshes[0];
        expect(ring.userData.gameplayRadius).toBe(16);
        expect(ring.geometry.parameters.outerRadius).toBe(16);
        effect.update(0.2);
        expect(ring.scale.x).toBeGreaterThanOrEqual(1);
    });

    test('renders Smoke Bomb particles inside an exact gameplay boundary', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'smoke_cloud',
            new THREE.Vector3(2, 0, -4),
            0x626978,
            { radius: 5 }
        );

        const group = effect.meshes[0];
        const boundary = group.children.find((child) => child.userData.isGameplayBoundary);
        expect(boundary).toBeDefined();
        expect(boundary.userData.gameplayRadius).toBe(5);
        expect(boundary.geometry.parameters.outerRadius).toBe(5);
        for (const cloud of group.children.filter((child) => !child.userData.isGameplayBoundary)) {
            expect(Math.hypot(cloud.position.x - 2, cloud.position.z + 4)).toBeLessThanOrEqual(4.5);
        }
    });

    test('drives cone particles to the supplied gameplay range and arc', () => {
        const scene = new THREE.Scene();
        const effect = createTransientEffect(
            scene,
            'cone',
            new THREE.Vector3(0, 0, 0),
            0xffffff,
            { radius: 5, arc: Math.PI, direction: new THREE.Vector3(0, 0, 1) }
        );

        const group = effect.meshes[0];
        expect(group.children[0].userData.gameplayRadius).toBe(5);
        const firstDirection = group.children[0].userData.dir;
        const lastDirection = group.children[group.children.length - 1].userData.dir;
        expect(firstDirection.angleTo(lastDirection)).toBeCloseTo(Math.PI, 5);
        effect.update(effect.duration);
        group.children.forEach((particle) => {
            expect(Math.hypot(particle.position.x, particle.position.z)).toBeCloseTo(5, 5);
        });
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
