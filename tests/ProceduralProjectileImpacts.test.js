import * as THREE from 'three';
import { jest } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS,
    createProceduralProjectileImpactEffect,
    getProceduralProjectileImpactCacheMetrics
} from '../src/art/ProceduralProjectileImpacts.js';
import { createTransientEffect } from '../src/core/TransientEffects.js';
import { Projectile } from '../src/entities/Projectile.js';
import { getProjectileImpactRadius } from '../src/skills/abilityRadii.js';

const TYPES = Object.freeze([
    'Fireball', 'ArcaneMissile', 'DragonfireLance', 'Dagger', 'FlameTornado',
    'Meteor', 'PhantomArrow', 'Tripwire', 'ExplosiveTrap', 'SnareTrap'
]);

function collectMeshes(root) {
    const meshes = [];
    root.traverse((part) => {
        if (part.isMesh) meshes.push(part);
    });
    return meshes;
}

function readServerCollisionProjectileSubtypes() {
    const types = new Set();
    const files = readdirSync('server/internal/game').filter((name) => /^ability_.*\.go$/.test(name));
    files.forEach((name) => {
        const source = readFileSync(join('server/internal/game', name), 'utf8');
        for (const match of source.matchAll(/&Entity\{([\s\S]*?)\n\s*\}/g)) {
            const body = match[1];
            if (!/Type:\s*TypeProjectile/.test(body)) continue;
            const subtype = body.match(/SubType:\s*"([^"]+)"/);
            if (subtype && !subtype[1].startsWith('Zone')) types.add(subtype[1]);
        }
    });
    return [...types].sort();
}

function owner() {
    return {
        id: 'owner',
        stats: { intelligence: 20, dexterity: 18, wisdom: 16 },
        skillRunes: {},
        isMultiplayer: false,
        isRemote: false,
        constructor: { name: 'Wizard' }
    };
}

describe('procedural projectile impacts', () => {
    test('the impact manifest exhaustively covers every collision-capable server projectile subtype', () => {
        expect(Object.keys(PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS).sort()).toEqual([...TYPES].sort());
        expect(readServerCollisionProjectileSubtypes()).toEqual([...TYPES].sort());
        const motifs = new Set();
        const styles = new Set();
        Object.values(PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS).forEach((definition) => {
            expect(['wizard', 'rogue']).toContain(definition.family);
            expect(definition.motif.length).toBeGreaterThan(8);
            expect(definition.artStyle.length).toBeGreaterThan(16);
            motifs.add(definition.motif);
            styles.add(definition.artStyle);
        });
        expect(motifs.size).toBe(TYPES.length);
        expect(styles.size).toBe(TYPES.length);
    });

    test.each(TYPES)('%s creates a named multi-part cached impact in high and low quality', (type) => {
        for (const quality of ['high', 'low']) {
            const scene = new THREE.Group();
            const effect = createProceduralProjectileImpactEffect(scene, new THREE.Vector3(2, 0, 3), {
                projectileType: type,
                quality,
                direction: new THREE.Vector3(1, 0, 1),
                terminal: true,
                targetId: 'target'
            });
            const root = effect.root;
            const definition = PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS[type];
            const visible = collectMeshes(root).filter((part) => part.visible);
            expect(root.name).toBe(`ProceduralProjectileImpact:${type}`);
            expect(root.userData).toEqual(expect.objectContaining({
                proceduralProjectileImpact: true,
                projectileType: type,
                impactFamily: definition.family,
                motif: definition.motif,
                artStyle: definition.artStyle,
                quality,
                gameplayRadius: definition.gameplayRadius,
                terminal: true,
                targetId: 'target',
                sharedGeometry: true,
                sharedMaterials: true
            }));
            expect(visible.length).toBeGreaterThanOrEqual(8);
            effect.update(0.25);
            root.traverse((part) => {
                expect(part.position.toArray().every(Number.isFinite)).toBe(true);
                expect(part.scale.toArray().every(Number.isFinite)).toBe(true);
            });
            effect.dispose();
            expect(root.parent).toBeNull();
        }
    });

    test('a zero-radius wall impact has visible sparks but no damage-area boundary', () => {
        const effect = createProceduralProjectileImpactEffect(new THREE.Group(), new THREE.Vector3(), {
            projectileType: 'Fireball', radius: 0, quality: 'high'
        });
        const meshes = collectMeshes(effect.root);
        expect(meshes.length).toBeGreaterThan(0);
        expect(meshes.filter(part => part.userData.gameplayBoundary)).toHaveLength(0);
        effect.dispose();
    });

    test.each([
        ['Fireball', 10],
        ['ExplosiveTrap', 6],
        ['Meteor', 39.6]
    ])('%s holds an exact visible AoE boundary at %s units', (type, radius) => {
        const effect = createProceduralProjectileImpactEffect(new THREE.Group(), new THREE.Vector3(), {
            projectileType: type,
            radius,
            quality: 'high'
        });
        const boundaries = collectMeshes(effect.root).filter((part) => part.userData.gameplayBoundary);
        expect(boundaries).toHaveLength(2);
        boundaries.forEach((part) => {
            expect(part.userData.gameplayRadius).toBe(radius);
            expect(part.userData.normalizedGameplayRadius).toBe(1);
            expect(part.scale.x).toBe(radius);
        });
        effect.update(0.4);
        boundaries.forEach((part) => expect(part.scale.toArray()).toEqual([radius, radius, radius]));
    });

    test('the shared transient dispatcher selects typed impacts and fails closed for an unknown type', () => {
        const scene = new THREE.Group();
        const effect = createTransientEffect(scene, 'projectile_impact', new THREE.Vector3(), 0xffffff, {
            projectileType: 'Dagger'
        });
        expect(effect.root.userData.projectileType).toBe('Dagger');
        expect(() => createTransientEffect(scene, 'projectile_impact', new THREE.Vector3(), 0xffffff, {
            projectileType: 'UnknownBolt'
        })).toThrow('Unknown procedural projectile impact: UnknownBolt');
    });

    test('explosive footprint lookup matches server values and meteor rune variants', () => {
        expect(getProjectileImpactRadius('Fireball')).toBe(10);
        expect(getProjectileImpactRadius('ExplosiveTrap')).toBe(6);
        expect(getProjectileImpactRadius('Meteor', { skillRunes: { 'Meteor Drop': 'meteor_cluster' } }, 0.7)).toBe(15.84);
        expect(getProjectileImpactRadius('Meteor', { skillRunes: { 'Meteor Drop': 'meteor_extinction' } }, 1)).toBe(39.6);
        expect(getProjectileImpactRadius('Meteor', { skillRunes: { 'Meteor Drop': 'meteor_apocalypse' } }, 0.7)).toBe(18.48);
    });

    test.each(TYPES)('%s routes offline collisions through its typed procedural impact', (type) => {
        const projectile = new Projectile(`local-${type}`, owner(), type,
            new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
        projectile.velocity.set(0, 0, 0);
        const target = {
            id: `target-${type}`,
            isActive: true,
            state: 'IDLE',
            radius: 0.5,
            position: new THREE.Vector3(),
            takeDamage: jest.fn(),
            constructor: { name: 'Enemy' }
        };
        const spawnTransientEffect = jest.fn(() => true);
        projectile.update(0.016, null, null, { getActiveEntities: () => [target] }, null, {
            spawnTransientEffect,
            effectScene: new THREE.Group()
        });
        expect(spawnTransientEffect).toHaveBeenCalledWith(
            'projectile_impact',
            expect.any(THREE.Vector3),
            0xffffff,
            expect.objectContaining({ projectileType: type, targetId: target.id })
        );
    });

    test('server-authoritative projectiles never predict duplicate client collision impacts', () => {
        const projectile = new Projectile('replicated-fireball', owner(), 'Fireball',
            new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
        projectile.velocity.set(0, 0, 0);
        projectile.serverAuthoritativeLifetime = true;
        const spawnTransientEffect = jest.fn(() => true);
        projectile.update(0.016, null, null, { getActiveEntities: () => [{
            id: 'target', isActive: true, state: 'IDLE', radius: 1,
            position: new THREE.Vector3(), takeDamage: jest.fn(), constructor: { name: 'Enemy' }
        }] }, null, { spawnTransientEffect, effectScene: new THREE.Group() });
        expect(spawnTransientEffect).not.toHaveBeenCalled();
    });

    test('geometry and material caches stabilize across repeated impacts', () => {
        createProceduralProjectileImpactEffect(new THREE.Group(), new THREE.Vector3(), { projectileType: 'Fireball' });
        const first = getProceduralProjectileImpactCacheMetrics();
        createProceduralProjectileImpactEffect(new THREE.Group(), new THREE.Vector3(), { projectileType: 'Fireball' });
        expect(getProceduralProjectileImpactCacheMetrics()).toEqual(first);
        expect(first.geometries).toBeGreaterThan(5);
        expect(first.materials).toBeGreaterThan(0);
    });
});
