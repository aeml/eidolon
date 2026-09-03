import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS,
    applyProceduralProjectileScale,
    createProceduralProjectileVisual,
    getProceduralProjectileCacheMetrics,
    releaseProceduralProjectileVisual,
    updateProceduralProjectileVisual
} from '../src/art/ProceduralProjectileEffects.js';
import { Projectile } from '../src/entities/Projectile.js';

const TYPES = Object.freeze([
    'Fireball',
    'ArcaneMissile',
    'DragonfireLance',
    'Dagger',
    'FlameTornado',
    'Meteor',
    'PhantomArrow',
    'Tripwire',
    'ExplosiveTrap',
    'SnareTrap',
    'ZoneDamage',
    'ZoneHoly',
    'Zone'
]);

function createOwner() {
    return {
        stats: { intelligence: 20, dexterity: 18, wisdom: 16 },
        isMultiplayer: true,
        isRemote: true,
        constructor: { name: 'Wizard' }
    };
}

function collectMeshes(root) {
    const meshes = [];
    root.traverse((part) => {
        if (part.isMesh) meshes.push(part);
    });
    return meshes;
}

function readServerProjectileSubtypes() {
    const types = new Set();
    const files = readdirSync('server/internal/game').filter((name) => /^ability_.*\.go$/.test(name));
    files.forEach((name) => {
        const source = readFileSync(join('server/internal/game', name), 'utf8');
        for (const match of source.matchAll(/&Entity\{([\s\S]*?)\n\s*\}/g)) {
            const body = match[1];
            if (!/Type:\s*TypeProjectile/.test(body)) continue;
            const subtype = body.match(/SubType:\s*"([^"]+)"/);
            if (subtype) types.add(subtype[1]);
        }
    });
    return [...types].sort();
}

describe('procedural projectile, trap, and persistent-zone visuals', () => {
    test('the visual registry explicitly covers every production projectile subtype', () => {
        expect(Object.keys(PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS).sort()).toEqual([...TYPES].sort());
        for (const type of TYPES) {
            const definition = PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type];
            expect(['wizard', 'rogue', 'cleric']).toContain(definition.family);
            expect(['projectile', 'trap', 'zone']).toContain(definition.role);
            expect(definition.artStyle.length).toBeGreaterThan(8);
            expect(definition.gameplayRadius).toBeGreaterThan(0);
        }
    });

    test('every server-created projectile subtype has a direct visual and only the documented legacy alias is extra', () => {
        const serverTypes = readServerProjectileSubtypes();
        const clientTypes = Object.keys(PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS);
        expect(serverTypes).toEqual(TYPES.filter((type) => type !== 'Zone').sort());
        serverTypes.forEach((type) => expect(clientTypes).toContain(type));
        expect(clientTypes.filter((type) => !serverTypes.includes(type))).toEqual(['Zone']);
    });

    test.each(TYPES)('%s creates an intentional multi-part cached visual', (type) => {
        const root = createProceduralProjectileVisual(type);
        const definition = PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type];
        const meshes = collectMeshes(root);

        expect(root).toBeInstanceOf(THREE.Group);
        expect(root.name).toBe(`ProceduralProjectile:${type}`);
        expect(root.userData).toEqual(expect.objectContaining({
            proceduralProjectile: true,
            projectileType: type,
            projectileFamily: definition.family,
            projectileRole: definition.role,
            artStyle: definition.artStyle,
            gameplayRadius: definition.gameplayRadius,
            sharedResources: true
        }));
        expect(meshes.length).toBeGreaterThanOrEqual(4);
        meshes.forEach((part) => {
            expect(part.geometry).toBeTruthy();
            expect(part.material).toBeTruthy();
        });
    });

    test.each(['Tripwire', 'ExplosiveTrap', 'SnareTrap', 'ZoneDamage', 'ZoneHoly', 'Zone'])(
        '%s keeps a visible boundary at exactly its declared base radius',
        (type) => {
            const root = createProceduralProjectileVisual(type);
            const definition = PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type];
            const boundaries = collectMeshes(root).filter((part) => part.userData.gameplayBoundary);

            expect(boundaries.length).toBeGreaterThan(0);
            boundaries.forEach((boundary) => {
                boundary.geometry.computeBoundingSphere();
                expect(boundary.geometry.boundingSphere.radius).toBeCloseTo(definition.gameplayRadius, 5);
                expect(boundary.userData.gameplayRadius).toBe(definition.gameplayRadius);
            });

            updateProceduralProjectileVisual(root, type, 3.25, 0.16);
            boundaries.forEach((boundary) => {
                expect(boundary.scale.toArray()).toEqual([1, 1, 1]);
            });
        }
    );

    test('server-encoded zone scaling updates both the rendered and declared exact radius', () => {
        const root = createProceduralProjectileVisual('ZoneDamage');
        applyProceduralProjectileScale(root, 2.4);
        root.updateMatrixWorld(true);

        expect(root.scale.toArray()).toEqual([1, 1, 1]);
        expect(root.userData.gameplayRadius).toBeCloseTo(12, 8);
        const boundaries = collectMeshes(root).filter((part) => part.userData.gameplayBoundary);
        boundaries.forEach((boundary) => expect(boundary.userData.gameplayRadius).toBeCloseTo(12, 8));

        const projectile = new Projectile(
            'zone-scale',
            createOwner(),
            'ZoneDamage',
            new THREE.Vector3(),
            new THREE.Vector3()
        );
        projectile.setScale(2.4);
        expect(projectile.mesh.scale.toArray()).toEqual([2.4, 2.4, 2.4]);
        expect(projectile.mesh.userData.gameplayRadius).toBeCloseTo(12, 8);
    });

    test('projectile entities use the explicit visual and matching collision radius for every subtype', () => {
        for (const type of TYPES) {
            const projectile = new Projectile(
                `projectile-${type}`,
                createOwner(),
                type,
                new THREE.Vector3(),
                new THREE.Vector3(0, 0, 1)
            );
            expect(projectile.mesh.userData.proceduralProjectile).toBe(true);
            expect(projectile.mesh.userData.projectileType).toBe(type);
            expect(projectile.radius).toBe(PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type].gameplayRadius);

            projectile.update(0.16, null, null, null, null, null);
            projectile.mesh.traverse((part) => {
                expect(part.position.toArray().every(Number.isFinite)).toBe(true);
                expect(part.quaternion.toArray().every(Number.isFinite)).toBe(true);
                expect(part.scale.toArray().every(Number.isFinite)).toBe(true);
            });
        }
    });

    test('instances share immutable geometry and materials while retaining independent motion', () => {
        const first = createProceduralProjectileVisual('Fireball');
        const metricsAfterFirst = getProceduralProjectileCacheMetrics();
        const second = createProceduralProjectileVisual('Fireball');
        const metricsAfterSecond = getProceduralProjectileCacheMetrics();
        const firstMeshes = collectMeshes(first);
        const secondMeshes = collectMeshes(second);

        expect(metricsAfterSecond).toEqual(metricsAfterFirst);
        expect(secondMeshes).toHaveLength(firstMeshes.length);
        firstMeshes.forEach((part, index) => {
            expect(secondMeshes[index].geometry).toBe(part.geometry);
            expect(secondMeshes[index].material).toBe(part.material);
        });

        updateProceduralProjectileVisual(first, 'Fireball', 1.2, 0.2);
        expect(first.getObjectByName('Fireball:Spin').rotation.y).not.toBe(0);
        expect(second.getObjectByName('Fireball:Spin').rotation.y).toBe(0);
    });

    test('release detaches and clears an instance without disposing shared resources', () => {
        const scene = new THREE.Group();
        const first = createProceduralProjectileVisual('Tripwire');
        const second = createProceduralProjectileVisual('Tripwire');
        const firstMesh = collectMeshes(first)[0];
        const secondMesh = collectMeshes(second)[0];
        scene.add(first);

        expect(firstMesh.geometry).toBe(secondMesh.geometry);
        expect(firstMesh.material).toBe(secondMesh.material);
        releaseProceduralProjectileVisual(first);

        expect(first.parent).toBeNull();
        expect(first.children).toHaveLength(0);
        expect(second.children.length).toBeGreaterThan(0);
        expect(secondMesh.geometry.attributes.position).toBeDefined();
    });

    test('unknown projectile visuals fail closed instead of becoming a generic primitive', () => {
        expect(() => createProceduralProjectileVisual('UnclassifiedBolt')).toThrow(
            'Unknown procedural projectile visual: UnclassifiedBolt'
        );
    });
});
