import * as THREE from 'three';
import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
    createProceduralAreaField,
    getProceduralAreaFieldCacheMetrics,
    PROCEDURAL_AREA_FIELD_DEFINITIONS,
    releaseProceduralAreaField,
    updateProceduralAreaField
} from '../src/art/ProceduralAreaFields.js';

const EXPECTED_FIELD_TYPES = Object.freeze([
    'BurningGround',
    'InfernoCataclysm',
    'GravityWell',
    'SmokeBomb'
]);

function renderedParts(root) {
    const parts = [];
    root.traverse((part) => {
        if (part.isMesh) parts.push(part);
    });
    return parts;
}

function gameplayBoundaries(root) {
    return renderedParts(root).filter((part) => part.userData.gameplayBoundary);
}

describe('procedural persistent area fields', () => {
    const repoRoot = path.resolve(process.cwd());

    test('the registry exhaustively names every remaining local field family', () => {
        expect(Object.keys(PROCEDURAL_AREA_FIELD_DEFINITIONS).sort()).toEqual([...EXPECTED_FIELD_TYPES].sort());
        for (const definition of Object.values(PROCEDURAL_AREA_FIELD_DEFINITIONS)) {
            expect(definition.family).toMatch(/^(wizard|rogue)$/);
            expect(definition.artStyle.length).toBeGreaterThan(8);
            expect(definition.baseRadius).toBeGreaterThan(0);
        }
    });

    test.each(EXPECTED_FIELD_TYPES)('%s is multi-part code art with an exact stable gameplay boundary', (type) => {
        const radius = type === 'GravityWell' ? 12 : PROCEDURAL_AREA_FIELD_DEFINITIONS[type].baseRadius;
        const root = createProceduralAreaField(type, radius);
        const parts = renderedParts(root);
        const boundaries = gameplayBoundaries(root);

        expect(root).toBeInstanceOf(THREE.Group);
        expect(root.userData).toMatchObject({
            proceduralAreaField: true,
            areaFieldType: type,
            gameplayRadius: radius,
            sharedResources: true
        });
        expect(root.scale.toArray()).toEqual([radius, radius, radius]);
        expect(parts.length).toBeGreaterThan(8);
        expect(boundaries.length).toBeGreaterThanOrEqual(2);
        boundaries.forEach((part) => {
            expect(part.userData.gameplayRadius).toBe(radius);
            expect(part.userData.normalizedGameplayRadius).toBe(1);
        });

        updateProceduralAreaField(root, 1.4, 0.5);
        boundaries.forEach((part) => expect(part.scale.toArray()).toEqual([1, 1, 1]));
    });

    test('low quality retains the exact boundary while reducing interior ornaments', () => {
        const high = createProceduralAreaField('SmokeBomb', 5, { quality: 'high' });
        const low = createProceduralAreaField('SmokeBomb', 5, { quality: 'low' });

        expect(gameplayBoundaries(high)).toHaveLength(gameplayBoundaries(low).length);
        expect(renderedParts(low).length).toBeLessThan(renderedParts(high).length);
        expect(low.userData.gameplayRadius).toBe(5);
    });

    test('instances share immutable resources but keep independent animated poses', () => {
        const first = createProceduralAreaField('GravityWell', 8);
        const second = createProceduralAreaField('GravityWell', 8);
        const firstParts = renderedParts(first);
        const secondParts = renderedParts(second);

        expect(firstParts[0].geometry).toBe(secondParts[0].geometry);
        expect(firstParts[0].material).toBe(secondParts[0].material);
        updateProceduralAreaField(first, 1, 0.5);
        expect(first.getObjectByName('GravityWell:Spin').rotation.y).not.toBe(
            second.getObjectByName('GravityWell:Spin').rotation.y
        );
        expect(getProceduralAreaFieldCacheMetrics().geometries).toBeGreaterThan(0);
        expect(getProceduralAreaFieldCacheMetrics().materials).toBeGreaterThan(0);
    });

    test('release detaches roots without disposing resources still used by other fields', () => {
        const parent = new THREE.Group();
        const first = createProceduralAreaField('BurningGround', 3.5);
        const second = createProceduralAreaField('BurningGround', 3.5);
        parent.add(first, second);
        const part = renderedParts(first)[0];
        const geometryDispose = jest.spyOn(part.geometry, 'dispose');
        const materialDispose = jest.spyOn(part.material, 'dispose');

        releaseProceduralAreaField(first);

        expect(first.parent).toBeNull();
        expect(first.children).toHaveLength(0);
        expect(second.children.length).toBeGreaterThan(0);
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(materialDispose).not.toHaveBeenCalled();
    });

    test('unknown field types fail closed instead of silently restoring generic geometry', () => {
        expect(() => createProceduralAreaField('GenericCylinder', 5)).toThrow(
            'Unknown procedural area field: GenericCylinder'
        );
    });

    test('production routes name every field and resolve drift-prone radii from the authoritative registry', () => {
        const areaSource = fs.readFileSync(path.join(repoRoot, 'src/entities/AreaOfEffect.js'), 'utf8');
        const wizardSource = fs.readFileSync(path.join(repoRoot, 'src/entities/Wizard.js'), 'utf8');
        const gallerySource = fs.readFileSync(path.join(repoRoot, 'src/animationGallery.js'), 'utf8');

        expect(areaSource).not.toMatch(/CylinderGeometry|SphereGeometry|RingGeometry|visualType/);
        EXPECTED_FIELD_TYPES.forEach((type) => {
            expect(`${wizardSource}\n${gallerySource}`).toContain(`'${type}'`);
        });
        expect(wizardSource).toContain("getAbilityAoeRadius('Wizard', 'Gravity Well', this) || 8");
        expect(gallerySource).toContain("getAbilityAoeRadius('Wizard', 'Gravity Well', actor) || 8");
        expect(gallerySource).toContain("getAbilityAoeRadius('Rogue', 'Smoke Bomb', actor) || 5");
        expect(wizardSource).not.toContain('radius: 6.0');
    });
});
