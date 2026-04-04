import * as THREE from 'three';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem scene groups', () => {
    test('initializes dedicated environment, entity, and effect groups on the root scene', () => {
        const renderSystem = new RenderSystem(false);

        expect(renderSystem.environmentGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.entityGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.effectGroup).toBeInstanceOf(THREE.Group);
        expect(renderSystem.environmentGroup.parent).toBe(renderSystem.scene);
        expect(renderSystem.entityGroup.parent).toBe(renderSystem.scene);
        expect(renderSystem.effectGroup.parent).toBe(renderSystem.scene);
    });

    test('clears only dynamic instance content while preserving environment content', () => {
        const renderSystem = new RenderSystem(false);
        const environmentMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const entityMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const effectMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());

        renderSystem.environmentGroup.add(environmentMesh);
        renderSystem.entityGroup.add(entityMesh);
        renderSystem.effectGroup.add(effectMesh);

        renderSystem.clearInstanceScene();

        expect(renderSystem.environmentGroup.children).toContain(environmentMesh);
        expect(renderSystem.entityGroup.children).toHaveLength(0);
        expect(renderSystem.effectGroup.children).toHaveLength(0);
        expect(environmentMesh.parent).toBe(renderSystem.environmentGroup);
        expect(entityMesh.parent).toBeNull();
        expect(effectMesh.parent).toBeNull();
    });
});