import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem scene groups', () => {
    test.each([
        ['earth_crystal_raid', 'verdant_bastion_catacombs'],
        ['water_crystal_raid', 'abyssal_well'],
        ['fire_crystal_raid', 'molten_core'],
        ['air_crystal_raid', 'tempest_spire'],
        ['weekly_raid', 'umbral_nexus']
    ])('%s uses its authored realm atmosphere at remote instance coordinates', (raidType, theme) => {
        const renderSystem = new RenderSystem(false);
        const position = new THREE.Vector3(80000, 0, 19280);
        expect(renderSystem.setEnvironmentContext(raidType, position, true)).toBe(theme);
        expect(renderSystem.environmentThemeOverride).toBe(theme);
        expect(renderSystem.getRealmForPosition(position)).toBe(theme);
    });

    test('initializes dedicated environment, entity, and effect groups on the root scene', () => {
        const renderSystem = new RenderSystem(false);

        expect(renderSystem.environmentGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.staticEnvironmentGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.instanceEnvironmentGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.entityGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.effectGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.environmentGroup.parent).toBe(renderSystem.scene);
        expect(renderSystem.staticEnvironmentGroup.parent).toBe(renderSystem.environmentGroup);
        expect(renderSystem.instanceEnvironmentGroup.parent).toBe(renderSystem.environmentGroup);
        expect(renderSystem.entityGroup.parent).toBe(renderSystem.scene);
        expect(renderSystem.effectGroup.parent).toBe(renderSystem.scene);
    });

    test('clears only dynamic instance content while preserving static environment content', () => {
        const renderSystem = new RenderSystem(false);
        const environmentMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const instanceEnvironmentMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const entityMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const effectMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());

        renderSystem.staticEnvironmentGroup.add(environmentMesh);
        renderSystem.instanceEnvironmentGroup.add(instanceEnvironmentMesh);
        renderSystem.entityGroup.add(entityMesh);
        renderSystem.effectGroup.add(effectMesh);
        const staticGeometryDispose = jest.spyOn(environmentMesh.geometry, 'dispose');
        const staticMaterialDispose = jest.spyOn(environmentMesh.material, 'dispose');
        const instanceGeometryDispose = jest.spyOn(instanceEnvironmentMesh.geometry, 'dispose');
        const instanceMaterialDispose = jest.spyOn(instanceEnvironmentMesh.material, 'dispose');

        renderSystem.clearInstanceScene();

        expect(renderSystem.staticEnvironmentGroup.children).toContain(environmentMesh);
        expect(renderSystem.instanceEnvironmentGroup.children).toHaveLength(0);
        expect(renderSystem.entityGroup.children).toHaveLength(0);
        expect(renderSystem.effectGroup.children).toHaveLength(0);
        expect(environmentMesh.parent).toBe(renderSystem.staticEnvironmentGroup);
        expect(instanceEnvironmentMesh.parent).toBeNull();
        expect(entityMesh.parent).toBeNull();
        expect(effectMesh.parent).toBeNull();
        expect(staticGeometryDispose).not.toHaveBeenCalled();
        expect(staticMaterialDispose).not.toHaveBeenCalled();
        expect(instanceGeometryDispose).toHaveBeenCalledTimes(1);
        expect(instanceMaterialDispose).toHaveBeenCalledTimes(1);
    });

    test('routes dungeon atmosphere by instance identity instead of remote coordinate quadrant', () => {
        const renderSystem = new RenderSystem(false);
        const remoteDungeonPosition = new THREE.Vector3(50000, 0.5, 20000);

        for (const dungeonType of [
            'verdant_bastion_catacombs',
            'molten_core',
            'tempest_spire',
            'abyssal_well'
        ]) {
            expect(renderSystem.setEnvironmentContext(dungeonType, remoteDungeonPosition, true)).toBe(dungeonType);
            expect(renderSystem.getRealmForPosition(remoteDungeonPosition)).toBe(dungeonType);
            expect(renderSystem.currentRealm).toBe(dungeonType);
            expect(renderSystem.currentLighting.fogNear).toBe(renderSystem.realmLightingPresets[dungeonType].fogNear);
        }

        expect(renderSystem.setEnvironmentContext('overworld', new THREE.Vector3(0, 0.5, 200), true)).toBe('town');
        expect(renderSystem.environmentThemeOverride).toBeNull();
        expect(renderSystem.getRealmForPosition(new THREE.Vector3(-2400, 0.5, 200))).toBe('fire');
    });

    test('disposes shared instance resources and procedural texture maps exactly once', () => {
        const renderSystem = new RenderSystem(false);
        const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
        const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        const material = new THREE.MeshBasicMaterial({ map });
        const root = new THREE.Group();
        root.add(new THREE.Mesh(sharedGeometry, material));
        root.add(new THREE.Mesh(sharedGeometry, material));
        const geometryDispose = jest.spyOn(sharedGeometry, 'dispose');
        const materialDispose = jest.spyOn(material, 'dispose');
        const textureDispose = jest.spyOn(map, 'dispose');

        renderSystem.disposeObjectResources(root);

        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        expect(textureDispose).toHaveBeenCalledTimes(1);
    });
});
