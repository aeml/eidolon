import * as THREE from 'three';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem scene groups', () => {
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

        renderSystem.clearInstanceScene();

        expect(renderSystem.staticEnvironmentGroup.children).toContain(environmentMesh);
        expect(renderSystem.instanceEnvironmentGroup.children).toHaveLength(0);
        expect(renderSystem.entityGroup.children).toHaveLength(0);
        expect(renderSystem.effectGroup.children).toHaveLength(0);
        expect(environmentMesh.parent).toBe(renderSystem.staticEnvironmentGroup);
        expect(instanceEnvironmentMesh.parent).toBeNull();
        expect(entityMesh.parent).toBeNull();
        expect(effectMesh.parent).toBeNull();
    });
});
